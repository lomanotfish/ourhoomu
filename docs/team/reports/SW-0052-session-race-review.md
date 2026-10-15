# SW-0052 — independent session race security review

Verdict: **approve** for the SW-0049 core data correction at
`d01aba2cae6c1a30da40b1e47ee5e7f9be08cdc3`. No blocking findings remain
in this review's scope. The original SW-0046 changes_requested verdict on
`e62d1ad` is resolved by the corrected gate and fresh independent verification;
ordinary suite success alone was not used to dismiss that finding.

## Authority and isolation

Reviewed in the existing clean isolated worktree
`/Users/afe/orca/workspaces/ourhoomu/sw-0052-session-review`, branch
`witchagorn/sw-0052-session-review`. Task `task_194863971b2f`, Dispatch
`ctx_91568bd131fa`; only this report is written/committed. Lead owns acceptance,
status/checklist, merge, release and cleanup. No nested agents were launched.

Read supplied AGENTS, requirements/board/agent guide, domain/API contract,
SW-0046 and SW-0049 reports, and current SW-0049/SW-0052 tickets using
`git show local:docs/team/tickets/SW-0049.md` and the equivalent SW-0052 path
(the latter is absent from frozen HEAD). Applied Graft, software-tech-lead
worker runtime guidance, code-review-and-quality and verification-before-completion.
Actual shell parent PID 5909 was observed as
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`; no model override
was supplied. Runtime instructions also specify never approval/full filesystem
access. Permissions did not expand report-only ownership.

Lead message `msg_ef4014f47bf8` confirmed this Dispatch exclusively owned the
existing synthetic DB verification window until settlement. All DB suites ran
sequentially, followed by a read-only catalog transaction. No migration, reset,
drop, rehearsal, SQL regeneration, provider, production, deployment or external
publication operation occurred. No credentials or connection URLs were printed.

## Security and lock-order assessment

- `ourhoomu-api/drizzle/0001_core_operations.sql:94–123`: non-house operations
  acquire the actor user row with `FOR NO KEY UPDATE`; house operations acquire
  the house through `require_member` (52–60), and invitation acceptance acquires
  house/invitation (99–107). Every branch then takes the same immutable family
  root ordered by `generation,id` before child locks, replay or mutation.
  Ordinary commands use `FOR SHARE`; app logout uses `FOR UPDATE` immediately.
  `core.actor()` is re-evaluated after these potentially blocking scope/root
  waits. A revocation that commits first therefore cannot authorize a command
  using the actor captured at entry. House-scope denial may remain `not_found`
  after the fresh membership check; it does not disclose or mutate resources.
- Child locks at 126–173 and idempotency lookup/return at 176–181 are inside
  the held family gate. Exact replay cannot bypass fresh session, membership,
  resource visibility or expiry checks. User/house scope serialization remains
  ahead of actor/route/key/body-exact replay. No changed grants, policies,
  privilege escalation, secret projection or new SQL interpolation was introduced.
- Account update/archive retains owner filtering and version checks (158–160,
  234 onward). Publish acquires its recipient-account row later (272), while
  the family gate is still held. It also rechecks live membership, expiry,
  account state/version before snapshotting. Authority mutation cannot commit
  during this late wait or between statement completion and transaction end.
- Refresh/rotation, different-key ancestor reuse and verifier revoke acquire
  the same root exclusively before generation updates (442–465); app logout
  already owns it exclusively (118–119, 402–405), avoiding a lock upgrade.
  A generation-1 command protects generation-0 root, so ancestor reuse cannot
  invalidate the family during its remaining write interval. Replay-secret
  cleanup also acquires family roots before session updates (543 onward).
- Canonical paths are user `NO KEY UPDATE` → family → account/locator, and
  house → family → bill/share/attempt or chore/schedule → locator; publish's
  account wait remains after family. Auth routines acquire family then generation,
  and rotation insertion needs a user FK `KEY SHARE`. The weaker user lock is
  compatible with that FK, including another session family for the same user.
  Auth routines do not take house/account/invitation locks. No new single-command
  inversion was found. Existing whole-transaction retry for serialization/deadlock
  (`src/db/connection.ts:83–119`) remains necessary for arbitrary multi-command
  callback graphs; callbacks must remain DB-only because they may be retried.

The authorization serialization point is the family lock: revocation wins and
the command is denied, or the command wins and revocation waits for its entire
transaction. This is not asynchronous cancellation of already authorized work.
Natural expiry still advances with the clock. There is no implemented account
deletion/deactivation workflow here to certify; future user-state mutation and
physical retention routines must preserve these authority/lock invariants.

## Fresh verification on 2026-10-15

Commands below ran from `ourhoomu-api/`, all exit 0. DB commands used only:

```sh
export SYNTHETIC_DB_ENV_FILE=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env
export NEON_BRANCH_RECEIPT=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json
```

Existing `loadTarget()` validated exact project `lucky-bar-14515304`, branch
`br-weathered-thunder-b38dgxbm`, endpoint `ep-dry-breeze-b3e8t69s`, receipt
identity/schema-only origin/expiry, direct owner URL and distinct restricted
app/auth credentials before connection. No ambient root environment was loaded.

| Command | Independent observed result |
| --- | --- |
| `bun install --frozen-lockfile` | Bun 1.4.3; 79 installs checked across 205 packages, no changes. |
| `bun run format:check` | 25 files checked; no fixes. |
| `bun run lint` | 25 files checked; no warnings/errors or suppressions. |
| `bun run typecheck` | Passed. |
| `bun run test` | 10 pass, 0 fail, 35 assertions, 5 files. |
| `bunx drizzle-kit check` | Passed, “Everything's fine”. No generation/migration performed. |
| `bun scripts/db/check.ts` | All 21 groups passed using actual app/auth/owner connections; RLS/routine hardening, money, FK/privacy, membership/expiry/replay, account/publish races, retry and rollback/context checks. |
| `bun scripts/db/check-sessions.ts` | All 4 groups passed: challenge/concurrent exact refresh/reuse, logout precedence, replay window, expired actor. |
| `bun scripts/db/check-session-races.ts` | All 20 groups passed; detailed guarantees below. |
| Guarded `bun -e` read-only catalog comparison | Five function bodies exactly matched frozen migration; original role and runtime namespace OIDs matched. |
| `git diff --check` | Passed before report and again before commit. |
| `graft check` | Wiring graph in sync; deep layer intentionally not built. |

Race coverage (`scripts/db/check-session-races.ts:48–73,122–548`) independently
exercised 11 revoke-before-scope cases: house create and replay, account create,
update/archive, house update and replay, bill create and replay, chore create,
and invitation acceptance. Each observes a real blocking edge, commits verifier
revocation before scope unlock, asserts access verification fails, requires the
expected SQL error, and compares persisted mutation/event/locator state. This
includes the original SW-0046 reproduction; corrected house.create returns
`P0001/unauthenticated` instead of success.

Three child-wait cases (account update, bill update, chore completion), four
transaction-interval cases (revoke, rotation, generation-1 ancestor reuse,
restricted-app logout), late publish account wait, and sibling-family FK
compatibility make up the remaining nine groups. Waiting assertions require
both `wait_event_type='Lock'` and the exact blocker in `pg_blocking_pids`;
8-second polling deadlines and 15-second transaction statement timeouts bound
the tests. A 20ms polling backoff is not the success criterion. Tests prove
authority waits both during child blocking and after statement return, until
the app rolls back. Mutation transactions roll back; synthetic fixture setup,
rotation and intentional revocations remain as documented by the scripts.

The independent catalog probe used `loadTarget()`, owner connection and
`BEGIN READ ONLY`; queried `pg_proc.prosrc` joined to `pg_namespace` for
`command`, `actor`, `require_member`, `auth_command`, `clear_replay_secrets`;
extracted each body from frozen `0001_core_operations.sql` between `AS $$` and
`$$;`; asserted exact equality after trimming outer whitespace, and printed
only function names/body hashes. It also asserted role OIDs app **41647**,
auth **41649**, writer **41645**, and `runtime_probe` namespace OID **24576**.
All assertions passed; transaction rolled back and pool closed. This establishes
effective corrected routines, rather than relying only on Lead's previous logs.

## Limits and handoff

No new severity/location/reproduction finding requires correction. The original
red result was documented in SW-0046/SW-0049; this reviewer did not reinstall
vulnerable SQL or repeat a schema rehearsal. Regression cases are representative,
not exhaustive for every operation or arbitrary transaction graph. Catalog body
parity covers the five authorization routines, not a complete schema diff.

Approval covers core data/session correction only. It does not certify live
native Google/Apple/Managed Auth validation, transport handlers/DTO integration,
SlipOK/LINE, transfer-reference dedupe/private slip storage, physical retention,
purge/backups/restore, production operation or release. Existing separate gates
remain. All verification pools closed, no pending transaction remains; this
worker releases its exclusive synthetic verification window at settlement for
Lead to retain or reassign.

**Graft: ACTIVE** — exact review worktree, CLI **0.21.1**;
`graft ask "session family root gate locking revoked actor transaction" --source`
returned indexed connection/session/test locations. SQL and Markdown/config are
not indexed, so targeted raw reads/diff were used for lock audit and instructions;
truncated retrieval required targeted connection reads. Final `graft check`
reported the wiring graph in sync (258 meaning nodes pending, deep layer not
built). One retrieval reported estimated **58,843 tokens saved**; this is the
tool's estimate, not measured billing savings. No savings claimed for check.
