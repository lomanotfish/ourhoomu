# SW-0063 independent read-projection review

TASK: Bounded independent source/test review of non-schedule read parity source
`a93dab2ddc9d7d2b878e3a553f0affb66637f02a`, base `244348c`. Review workspace:
`/Users/afe/orca/workspaces/ourhoomu/v4-sw63-review`, branch
`codex/v4-sw63-review`. This report is the only review-owned change.

STATUS: CHANGES_REQUESTED for the bounded dashboard authorization and chore
projection issues below. Schedule expiry remains an explicit unresolved product
decision; no mapping or schedule acceptance is inferred.

## Findings

1. **P2 — Dashboard authorization depends on demand-driven CTE evaluation.**
   `src/db/connection.ts:357` returns the aggregate query directly, unlike the
   other new list methods which call `ensureMember` first. The `viewer` CTE calls
   `core.reader`, but its results are used only inside relation-dependent
   predicates/subqueries. An empty house or an unauthorized principal with no
   RLS-visible child rows can leave these subplans unevaluated, rather than
   guaranteeing `not_found` before returning the aggregate JSON. This is a
   source-level authorization concern, **not a DB-reproduced failure** in this
   review. Add an explicit `await this.ensureMember(houseId)` before the query,
   and assert unauthorized access to the already-created empty `otherHouseId`
   and to a nonexistent house fails. The existing denied dashboard assertion
   targets the populated main house and does not cover this boundary.

2. **P2 — Chore projections return null for fields typed as optional strings.**
   Both the `dashboard` chore CTE and `chores()` construct `scheduleId`,
   `assigneeMembershipId` and `completedAt` unconditionally via
   `jsonb_build_object`. Their DB columns are nullable; a standalone pending
   chore therefore contains `scheduleId: null` and `completedAt: null`. However,
   `ChoreProjection` and the frozen wire `Chore` contract declare optional,
   non-null strings. Omit absent optional values in the DB projection, or
   accurately type internal nulls and require explicit HTTP normalization.
   Prefer omission here because these types describe the safe DTO projection.
   Check both the chore list and dashboard todayChores projection shapes.

3. **P2 — Reopened chores retain stale completion actor metadata.**
   The lateral completion lookup in both queries selects the latest event with
   `action='completed'`, regardless of the current occurrence status. After
   reopening, the occurrence is pending and its `completed_at` clears, but this
   lookup still adds the previous `completedByMembershipId`. The frozen wire
   field is present after completion only until reopen. Gate completion actor
   output on the current completed status and verify complete/reopen transitions
   through both projections. The prepared suite creates pending chores only.

## Positive bounded observations

- New list methods validate limits/cursor/date inputs, enforce house membership,
  and use parameterized SQL. Bills/payments order by created_at and ID, chores
  by local_date and ID, and activity uses descending created_at and ID both
  inside the limited query and in the JSON aggregation. `limit + 1` supports
  continuation without the former fixed 20/100-row total cap.
- Bill list filtering hides another creator's drafts. Payment summaries are
  scoped to the payer or the bill creator's awaiting cash decisions, and select
  explicit public fields. Account selection verifies the requested recipient
  matches the bill and retains the canonical creator/draft authorization.
- Read SQL checks live resource/parent expiry; accepted RLS additionally hides
  expired confirmation/completion events. Activity exposes a related title and
  kind, without account ciphertext, identifiers, provider payload or slip data.
- Per-bill monetary integers are bounded by the accepted 900000000000-satang
  constraints and command reservation/confirmation invariants. Dashboard totals
  aggregate as numeric and return decimal strings, avoiding unsafe aggregate
  JavaScript integer conversion. Own outstanding amount uses viewer membership;
  amounts owed to the viewer use recipient membership. Chore day selection uses
  house timezone and one statement timestamp.

## Verification and evidence limits

- `graft ask 'SW0063 bills payments activity dashboard read projections' --source -n 4`:
  succeeded in the review workspace; refreshed graph and reported estimated
  6,605 tokens saved. Direct diff/source reads supplied the truncated SQL/test
  spans. The SW-0063 ticket is absent from this frozen base; the implementation
  report and exact source delta were used instead.
- Read `/tmp/sw63-db-acceptance.txt`: observed seven PASS groups and final
  `SW-0063 read parity restricted-role suite: 7 groups passed; synthetic only`.
  The implementation report records a later zsh reserved-variable assignment
  failure, so no successful shell exit status is inferred from that wrapper.
  These are the DB owner's prior results, not reviewer-executed DB checks.
- `bun install --frozen-lockfile`: exit 0, Bun 1.4.3; no lockfile change.
- `cd ourhoomu-api && bun test tests`: exit 0, **67 passed, 0 failed,
  110 assertions**. These existing offline tests do not execute the new SQL.
- `cd ourhoomu-api && bun run typecheck && bun run lint && bun run format:check`:
  exit 0; lint/format checked 37 files and applied no changes.

No DB commands, credentials, provider calls, source/test changes, migrations or
authoritative status changes were made by this reviewer. The Core Pi owner
retains the exclusive DB window.

CHANGED_FILES: This report only.

ISSUES: Three narrow findings above; actual restricted-role DB recheck of their
corrections remains NOT VERIFIED. Active schedule expiry is separately pending.

NEXT_ACTION: Database owner implements the explicit membership guard, truthful
optional chore projections and reopened-state correction, adds focused guarded
acceptance assertions, and submits an immutable delta for re-review. DB execution
waits for Lead's exclusive-window handoff. Lead alone accepts/integrates/statuses.
