# SW-0063 data read parity

## Current checkpoint

The first required correction is the `clear_replay_secrets` lock order in the
unaccepted `0003_http_seam.sql` candidate. Accepted migration history `0000`–
`0002` remains unchanged. The old candidate SHA-256 was
`1ce60b914ef2fd08edbe6fe2de52e53458433fc92b4c82fc628f8907adca20a4`; the
corrected candidate SHA-256 is
`940d881e9b8e03c7f048ffd68e672755dd05e25e7d41d7dc89e06600fb1b590a`.

Result pruning now shares the existing final `idempotency_records` update,
which runs after the family-root lock loop. Its exact predecessor anchor must
occur once or the candidate refuses to apply. The update clears only expired
replay data, including legacy rows whose replay deadline is null, without
updating null-deadline rows that have no result payload. This keeps the command
lock order (family root, then idempotency row) consistent with the janitor.

The lifecycle fixture now ages `replay_until` to
`least(created_at + 5 minutes, statement_timestamp() - 1 second)` without
rewriting `created_at`, preserving `idempotency_valid` for old fixtures.

## Verification

Using the guarded mode-600 synthetic credentials and branch receipt documented
in `ourhoomu-api/README.md`:

- `bun scripts/db/check-http-seam-migration.ts` — passed transactional rollback
  and unknown-predecessor refusal.
- `bun scripts/db/migrate.ts patch-http-seam` — applied corrected candidate;
  reported SHA-256 `940d881e9b8e03c7f048ffd68e672755dd05e25e7d41d7dc89e06600fb1b590a`.
- `bun scripts/db/check-http-auth.ts` — 16 restricted auth checks passed.
- `bun scripts/db/check-http-seam.ts` — 11 restricted data checks passed.
- `bun scripts/db/check-http-schema.ts` — exit code 0.
- `bun scripts/db/check-http-seam-lifecycle.ts` — reapply no-op, drift refusal,
  occupied rollback refusal, and exact unoccupied rollback passed.
- Reapplied corrected `0003_http_seam.sql` after lifecycle rollback.

The first apply attempt failed with SQLSTATE `42601` because the new PL/pgSQL
anchor variables were undeclared. It rolled back transactionally. The variables
were declared, the migration rollback/refusal check passed, and the corrected
candidate then applied successfully.

The independent security reviewer still needs to recheck the corrected source
and lock-order behavior. SW-0063 read projections and their acceptance tests are
not implemented at this checkpoint.

## Read parity implementation checkpoint — 2026-10-16

The current isolated implementation adds paginated bills, payment summaries,
chores and activity reads, recipient-scoped account selection, and the expanded
dashboard projection in `src/db/connection.ts`. `CorePage<T>` is
`{ items: T[]; nextCursor: UUID | null }`; each cursor is the final item's ID,
while SQL resolves the row's stable ordering tuple (`created_at,id` for bills,
payments and activity; `local_date,id` for chores). This preserves the frozen
wire envelope's UUID-shaped `nextCursor` while following the OpenAPI ordering
contract. Limits remain 20 by default and 100 maximum. Activity summaries expose
only event kind and related chore/bill title; they do not include account,
payment-provider or slip details. Bill totals bounded by MAX_SATANG are JSON
integers; cross-house dashboard totals remain exact decimal strings.

The schedule list/detail implementation is gated by a contract mismatch. The
OpenAPI `ChoreSchedule.expiresAt` is required and non-null, but the accepted
schema has no active schedule expiry: `chore_schedules` is current state, and
only superseded revisions have `archive_expires_at`. Current domain policy also
classifies active schedules as current state. No expiry mapping has been
invented. Lead is obtaining the user's decision; schedule methods and the final
domain interface remain pending that answer.

Verification completed offline in this worktree:

- `bun install --frozen-lockfile` — completed with Bun 1.4.3.
- `bun run typecheck` — passed.
- `bun test tests` — 67 passed, 0 failed (110 assertions).
- `bun run format:check` — initially reported the required formatting change;
  `bunx biome format --write src/db/connection.ts` applied it.
- `bun run lint` — initially reported the two unused imports; they were removed.
- Restricted-role checks have not run for this checkpoint. The Lead's
  synthetic database window is currently withheld pending the real HTTP handler
  acceptance step. No database commands were run from this worktree.

Required next step: once the Lead grants a restricted synthetic DB window, run
read parity acceptance for list ordering/cursors and limits, expiry and
cross-house hiding, payment privacy, recipient account selector scope, exact
dashboard totals/local date, and activity privacy. Schedule acceptance stays
blocked until the required `expiresAt` mapping is resolved.

## Restricted read-parity acceptance prepared

Added `ourhoomu-api/scripts/db/check-read-parity.ts` as a synthetic-only
restricted-role suite. It covers two-page bill and payment lists, three-page
activity lists, same-local-date chore pagination and date filters, invalid
cursor/date/range rejection, draft and cross-house hiding, recipient-account
selector masking and scope, safe read projections, exact dashboard decimal
balances and integer pending amounts, Bangkok-local dashboard chores, expired
parent/child visibility, removed memberships, and revoked sessions. The
migration credential is used only to age disposable synthetic rows for expiry
tests; app reads remain through the restricted runtime principal. The script
was not executed because the Lead reserved the current database window for API
handler acceptance.

The dashboard contract review found `outstandingSatang` was summing other
members' remaining shares. Updated its filter to the current viewer's own
membership and added a large synthetic exact-value acceptance assertion
(`2160000000000` satang). The restricted database assertion remains NOT
VERIFIED until run in the granted synthetic window.

Offline verification on this checkpoint:
- `cd ourhoomu-api && bun run typecheck` — passed, including the new acceptance
  script.
- `cd ourhoomu-api && bun run lint` — passed.
- `cd ourhoomu-api && bun test tests` — 67 passed, 0 failed (110 assertions).
- `cd ourhoomu-api && bunx biome format --write scripts/db/check-read-parity.ts
  src/db/connection.ts` — formatting applied; subsequent `bun run format:check`
  passed.
- `git diff --check` — passed after the report edit.

No DB calls were made. Schedule reads remain blocked on the required
`expiresAt` contract/schema decision documented above.


## Restricted read-parity acceptance — synthetic branch

After the Lead granted the guarded window, `bun scripts/db/check-read-parity.ts`
was run with the explicit mode-600 synthetic credential file and authoritative
branch receipt. The target guard passed for the pinned project, synthetic
branch, and endpoint. It used restricted app/auth roles for reads and owner
access only for disposable fixture expiry updates. No schema or migration
changes were made.

The full run reached its final success line: 7 acceptance groups passed for
bills, payments, chores, activity, dashboard, expired-parent visibility, and
removed/revoked access. Two findings were corrected from run evidence: chore
filter pagination testing needed `limit: 100` to inspect all 21 fixtures (the
API default remains 20), and activity aggregation had to preserve descending
order to avoid overlapping pages. A subsequent full run passed all 7 groups.
The synthetic app/auth/owner pools closed in `finally`; no read-parity runner
remains active and the DB window is released.

The Bun output log records the final suite success line. A zsh wrapper attempted
to assign the reserved variable name `status` after Bun finished, so the shell
exit code was not captured; there was no Bun/SQL error after the final success
line. Do not treat the wrapper's zsh assignment error as a DB test failure.
Schedule expiry remains gated on the product decision described above.

## Follow-up projection and authorization correction
An independent review identified that dashboard authorization depended on the
`core.reader` CTE, whose evaluation could be skipped when the selected house had
no dashboard rows. `dashboard()` now calls `ensureMember(houseId)` explicitly.
The synthetic acceptance script now expects denial for a nonmember reading an
empty other house and for an unknown house UUID.

The same review found chore list/dashboard JSON included null values for fields
that the read contract defines as optional, and could retain a historical
`completedByMembershipId` after reopen. Both chore projections now strip null
DTO properties and include completion actor only while the occurrence is
completed. Acceptance assertions cover pending, complete, and reopened states.

Offline checks after this correction: formatting, typecheck, lint, and the 67
unit tests pass (110 assertions). The guarded restricted-role database suite
has NOT been rerun after this correction; prior 7-group result applies to the
previous source SHA only. No database calls were made for this follow-up.

## Legacy core finance regression after dashboard assertion corrections
At commit `e73a071b24010384a931bc07199a0c02bb63aaeb`, the clean detached
worktree ran `bun scripts/db/check.ts` against the guarded synthetic target.
The target guard passed with the approved env and branch receipt both mode
0600. The runner exited `0` and reported `Core synthetic database checks
passed: 21`; all 21 groups passed, including exact satang/dashboard string
totals, payer-versus-creator cash decision counts, reservation caps and
release behavior, and cross-house/expiry authorization. The script used only
the synthetic app/auth roles plus owner fixture setup and expiry updates; it
made no schema or migration changes. Its `finally` closed all three pools and
the process exited without an active runner. Captured output is retained at
`/tmp/ourhoomu-corecheck-e73a071.log` in the local environment; credentials
and branch receipt contents are not included in this report.
