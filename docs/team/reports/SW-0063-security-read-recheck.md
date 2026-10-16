# SW-0063 independent corrected read-projection recheck

TASK: Recheck the three bounded findings in review `b5a71e9`. Application/data
source is `bb1da9b730940271a9dd27efa1404bd2c525af7f`. The Database owner's
additional acceptance assertions are commit
`62bcb613ff4fbbc3bbb773a7ad446be85f3a544b`. At the Lead's explicit direction,
that test-only commit was cherry-picked onto the isolated review checkout as
`67ba2bf8e930cfcf4d3fc888fc79145b38f89caf`; `git diff --quiet 62bcb613 67ba2bf`
confirmed identical trees. Test execution below uses that exact candidate.

Workspace `/Users/afe/orca/workspaces/ourhoomu/v4-sw63-recheck`, branch
`codex/v4-sw63-recheck`. Reviewer-authored changes are this report only. The test
implementation remains the Database owner's code. No source/test fixes were
authored by the reviewer; no migration, reset or production operation was run.

STATUS: APPROVE bounded non-schedule read parity. Source corrections and latest
guarded restricted-role acceptance passed. Exclusive DB window RELEASED.

## Findings resolved in source

- `dashboard()` now unconditionally awaits `ensureMember(houseId)` before its
  aggregate query. Authorization no longer depends on child rows causing the
  reader CTE to execute. Restricted assertions cover the populated house, an
  unauthorized empty house and a nonexistent house UUID.
- Both the chore list and dashboard todayChores use `jsonb_strip_nulls` around
  the constructed DTO, omitting nullable optional fields rather than publishing
  null against the non-null optional contract.
- Both projections add `completedByMembershipId` only while the current
  occurrence is completed. Reopening no longer exposes a historical completion
  actor on a pending chore.

The initial `bb1da9b` report claimed pending/completed/reopened assertions that
were absent from its committed script. The subsequent Database-owner commit
`62bcb613` supplies those assertions: pending standalone optional-key absence,
complete timestamp/actor, reopen status/metadata absence, plus optional-key
absence for dashboard todayChores. These are separate from the original seven
group evidence and are tested at candidate `67ba2bf` below.

## Verification

- `graft ask 'dashboard chores jsonb_strip_nulls completedByMembershipId ensureMember' --source -n 2`:
  succeeded, refreshed review graph and reported estimated 8,014 tokens saved.
  Source diff supplied the omitted dashboard/test spans.
- `bun install --frozen-lockfile`: exit 0, Bun 1.4.3; no lockfile change.
- On `bb1da9b`, `cd ourhoomu-api && bun test tests`: exit 0,
  **67 passed, 0 failed, 110 assertions**. These are offline component tests.
- On `bb1da9b`, `bun run typecheck`, `bun run lint`, `bun run format:check`:
  exit 0; lint/format checked 37 files and applied no edits.
- After applying test-only `62bcb613`, `bun run typecheck` and
  `git diff --check`: exit 0. Application/data source did not change.
- Lead explicitly granted this reviewer the exclusive guarded synthetic DB
  window after the Core QA owner released it. Both runs use explicit mode-600
  `SYNTHETIC_DB_ENV_FILE` and the authoritative `NEON_BRANCH_RECEIPT` under the
  project `.git/ourhoomu-snapshots/core-implementation/`; `loadTarget` pins the
  project, isolated branch, endpoint, role URLs and expiry. Secret values are
  not printed or recorded.
- Actual `bun scripts/db/check-read-parity.ts` on `bb1da9b`: **exit 0, seven
  groups passed**, including unauthorized empty/nonexistent-house dashboard
  denial. Log `/tmp/sw63-review-bb1da9b-db.log`. The process's actual exit code
  was obtained from the tool session, avoiding the prior reserved zsh variable
  wrapper mistake. The script closes all app/auth/owner pools in `finally`.
- Final snapshot after that first run: writer role OID 41645, NOLOGIN; app OID
  41647 and auth OID 41649, LOGIN; all three NOSUPERUSER/NOBYPASSRLS;
  runtime_probe OID 24576; writer schema CREATE false; other open client
  transactions zero. Snapshot pool closed in `finally`.
- Actual `bun scripts/db/check-read-parity.ts` on `67ba2bf`: **exit 0, seven
  groups passed**, now including the pending/completed/reopened chore assertions
  added in `62bcb613`. Log `/tmp/sw63-review-67ba2bf-db.log`. The observed final
  line was `SW-0063 read parity restricted-role suite: 7 groups passed;
  synthetic only`. Groups covered bills, payments, chore projections/transitions,
  activity, dashboard/empty-house denial, expired parents, and removed/revoked
  access. No failures or bypasses occurred in this run.
- Final read-only snapshot after `67ba2bf` exactly matched the first run's role
  OIDs/flags, probe OID and denied writer CREATE above; other open client
  transactions remained zero. Snapshot query used the guarded owner connection
  only for metadata reads, and closed its pool in `finally`.
- Reviewer explicitly RELEASED the exclusive DB window to the Lead after the
  latest test and final snapshot, with all test/snapshot pools closed.

## Scope retained

No schedule read implementation or `ChoreSchedule.expiresAt` mapping changed in
either corrected source or the test-only follow-up. Active schedule expiry stays
blocked on the user's product decision. Approval covers non-schedule read parity
only; it does not imply provider/native/release, AAD snapshot migration or full
MVP acceptance.

CHANGED_FILES: This report, plus the Database-owner test-only commit applied at
the Lead's direction for verification.

ISSUES: No remaining blocker in the reviewed non-schedule read scope. Active
schedule expiry and separate private-destination AAD work remain outside scope.

NEXT_ACTION: Lead may integrate the reviewed Database-owner source/assertions
with this evidence and update authoritative status. The DB window is released
for the next explicitly assigned owner; no additional reviewer DB work remains.
