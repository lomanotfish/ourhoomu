# SW-0049 — session revocation across lock waits

Worker scope: data correction only, from `b9906e586c5f44270e9d99d8bd9a3fb41c7844fa`
on `witchagorn/sw-0049-session-race`. Lead owns independent security acceptance,
integration, status/checklist updates and resource cleanup. Delivery SHA is sent
with the final Orca worker result; this report is committed with the correction.

## Authority and runtime

Read project AGENTS, requirements, board, domain/API contract, core implementation
authorization, agent guide, Lead's current SW-0049 ticket and baseline SW-0046
review. Used the installed Graft skill and software-tech-lead
`references/agent-runtime.md`; no installed data-engineer TOML was present, so
the assigned inline data-engineer role applies. No nested agents or coordinator
were opened. The worker owns no handlers, frontend, contract, root configuration,
ticket status, merge or cleanup changes.

Exact worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0049-session-race`.
Shell parent PID 68662 was observed in `ps -axo pid,ppid,args` as
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`.
This agrees with the session's `approval_policy=never` and
`sandbox_mode=danger-full-access`; it is actual launch evidence, not an inference
from an absent role profile.

Only the supplied explicit private paths were used:

```sh
export SYNTHETIC_DB_ENV_FILE=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env
export NEON_BRANCH_RECEIPT=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json
cd ourhoomu-api
```

Existing `loadTarget()` guards project `lucky-bar-14515304`, branch
`br-weathered-thunder-b38dgxbm`, endpoint `ep-dry-breeze-b3e8t69s`, branch expiry,
schema-only receipt, direct owner URL and separate real app/verifier roles before
any database access. No credentials were printed, no root environment was read,
and production, external deployment and providers were untouched.

Lead confirmed exclusive core-only rehearsal through blocking Orca ask and
message `msg_12d6b3f816ee`: review46 was stopped/released, other workers do not
access this DB, and this worker owns the mutation window until settlement.

## Red evidence

Before changing SQL, ran the newly written guarded
`bun scripts/db/check-session-races.ts` against the existing baseline database.
It issued a real verifier session, held the actor's user row with owner
`FOR UPDATE`, and invoked restricted-app `house.create` in another transaction.
The test observed `pg_stat_activity.wait_event_type='Lock'` and the exact owner
backend in `pg_blocking_pids(appPid)`. It then committed verifier revocation,
asserted access verification failed, and released the user lock.

Baseline returned success, producing this expected regression failure (exit 1):

```text
Session race check failed: house.create replay=false: revoked command succeeded
+ actual - expected
+ undefined
- 'P0001'
```

The mutation transaction was rolled back and connections released. Session
revocation intentionally persisted. No timing-only sleep decided the outcome.

The lock audit also rejected an intermediate gate placement after account locks:
publish takes its account later, so the gate must precede common child locks.
Finally, a dedicated same-user, different-session-family rotation test against
the intermediate `FOR UPDATE` user scope passed the other 19 groups but failed
with `canceling statement due to statement timeout` at its bounded 15-second
verifier rotation. Rotation's new-session FK requires user `KEY SHARE` after its
family root; this motivated the final `NO KEY UPDATE` user scope. An earlier
chore test fixture omitted its required assignee, failed typecheck/validation,
and was corrected before final verification. These were intermediate failures,
not passing acceptance evidence.

## Correction and lock reasoning

The unaccepted initial custom migration `0001_core_operations.sql` now:

1. Takes the existing user/house scope lock. User scope uses `FOR NO KEY UPDATE`,
   which still excludes another non-house command but permits session insertion's
   FK `KEY SHARE`. House membership is still checked after the house lock.
2. Locks the immutable family root, selected by `ORDER BY generation,id LIMIT 1`,
   with `FOR SHARE` for ordinary commands, or `FOR UPDATE` for app logout.
3. Re-evaluates `core.actor()` after that potentially blocking lock, rejecting
   a different/absent actor with `unauthenticated` before child lookup, replay
   or mutation. A revoked house-scope waiter can retain the existing `not_found`
   response from the membership guard; it cannot mutate or replay.
4. Holds the root lock until transaction commit/rollback, covering child locks,
   idempotency lookup, late publish account locks, writes and events.

Thus non-house commands use **user (NO KEY UPDATE) → family root → account →
locator/write**; household commands use **house → family root → bill/ordered
shares/attempts or chore children → locator/write**. Invitation acceptance retains
house/invitation locking before the family gate; no session routine locks an
invitation or house. The publish account is also after the family gate, matching
account update's relative account/root order. Shared family locks allow ordinary
commands to coexist. Logout takes the exclusive root immediately, avoiding a
new shared-to-exclusive upgrade in a standalone logout.

Verifier rotation, revoke, refresh-reuse revocation and replay cleanup already
take that same root exclusively before generation rows. They do not acquire
house/account locks. `NO KEY UPDATE` is compatible with rotation's subsequent
user FK lock, closing the user/root inversion. A generation-1 command protects
the generation-0 root, so ancestor reuse cannot revoke the family mid-write.

If revocation wins while an app waits for its scope, the app recheck rejects.
If the app wins its family gate, revocation waits for the entire app transaction
to finish. That is the authorization serialization point; it does not promise
cancellation of work that already won the lock. Existing whole-transaction
serialization/deadlock retries remain in `CoreDatabase`; callbacks must remain
database-only. Arbitrary multi-command/multi-house callback lock acquisition
can still require those retries; this report does not claim universal deadlock
freedom for arbitrary caller transaction graphs.

Every command branch shares the gate, including house/account creation and
update/archive, invitation acceptance, membership, bills, payment/cash, chores,
schedules, activity cursor and app logout. There is no new role, grant, routine,
transport projection or connection change. Live membership/expiry guards,
scope/body-exact idempotency and hardened roles remain in force. This is an
initial-schema correction rehearsed on disposable core, not an upgrade/reset
procedure for a populated product database.

## Deterministic regression coverage

The new script uses actual separately credentialed app/auth connections and owner
fixture locks; it never impersonates roles with `SET ROLE`. Each controlled
transaction has a 15-second statement timeout; blocking-edge polling has an
8-second deadline and a 20ms backoff. The backoff is not the assertion.

| Groups | Evidence |
| --- | --- |
| 11 revoke-before-scope cases | House create and exact replay; account create/update/archive; house update and replay; bill create and replay; chore create; invitation accept. Committed revocation precedes unblock; expected unauthenticated/hidden membership error; no changed resource counts/versions, locator, event or invitation consumption. |
| 3 child-wait cases | Account update, bill update and chore completion have entered their family gate, then wait on an owner-held child. Verifier revoke blocks on the app; after releasing child, it still blocks after the statement returns until app rollback. Durable state remains unchanged. |
| 4 mutation-interval cases | Verifier revoke, rotation, different-key ancestor refresh reuse against active generation 1, and restricted-app logout wait on a completed app statement's still-open transaction. Access is invalid after authority mutation commits. |
| 1 late publish wait | App publish waits on recipient account; verifier revoke waits on app both during that wait and after publish returns, until rollback. Bill remains draft with no persisted snapshot. |
| 1 FK compatibility case | A held app user-scope transaction in family A permits successful real rotation in sibling family B for the same user; A remains authorized until rollback. |

## Verification and reproducibility

Five coordinated core-only rollback/up cycles were used while refining and
rehearsing the correction. The last two used identical final SQL and emitted
identical SHA256 values:

```text
0000_core_schema.sql  bbdf30a4e26a4511cd118a47f6655c6228f227941cbdf41d6c99a848f924ec59
0001_core_operations.sql  9de69c5a2b4061067e34f73ce06febfd73346bcabaf2f5755afddaed1e6a45f6
```

No reset was performed before Lead's explicit rehearsal confirmation. Each
rollback dropped only `core`; the guarded migration reused roles/credentials.
Before and after all rehearsals, owner catalog queries verified original role
OIDs **app 41647 / auth 41649 / writer 41645**, and original `runtime_probe`
namespace OID **24576**. An explicit final assertion of these OIDs passed.

| Command | Observed outcome |
| --- | --- |
| `bun install --frozen-lockfile` | Bun 1.4.3; 77 packages installed, no manifest/lockfile diff. |
| `bun run format:check`; `bun run lint` | Passed; 25 files, no changes/suppressions. |
| `bun run typecheck` | Passed on final test script and unchanged application types. |
| `bun run test` | 10 pass, 0 fail, 35 assertions, five files. |
| `bunx drizzle-kit check` | Passed. |
| Temporary-copy Drizzle generation | Passed; 21 tables, no schema changes/nothing to migrate, exit 0. Used copied `drizzle/`, relative `out: ./drizzle`, absolute existing schema path; removed temp directory. Original snapshot/schema/config unchanged. |
| Final `bun scripts/db/check.ts` after last fresh up | 21 groups passed, exit 0. Includes actual restricted roles/RLS, money/idempotency, publish/account race, membership/expiry/replay, schedules, rollback/context, bounded retry and representative query plan. |
| Final `bun scripts/db/check-sessions.ts` after last fresh up | Four groups passed, exit 0: challenge/concurrent refresh/reuse, logout, replay window, expiry. |
| `bun scripts/db/check-session-races.ts` | 20 groups passed, exit 0, on both fresh final-SQL migrations; last run followed core21/session4 sequentially. |
| `git diff --check` | Passed. |
| `graft check` | Wiring graph in sync; deep layer intentionally not built. |

**Graft: ACTIVE** — version 0.21.1, exact worktree. Initial `graft map` refreshed
from the main-checkout cache against this worktree and returned 51 files / 194
symbols / 537 edges. Scoped `graft ask` located command/session/check boundaries;
`graft callers CoreDatabase --depth all` identified existing database suites.
Final `graft map` refreshed the new regression file and returned 52 files / 206
symbols / 602 edges; final check was in sync (258 nodes). SQL, Markdown/config
and new-file creation used raw reads because SQL/docs are not indexed; truncated
source spans used exact raw reads. One interim `graft check` correctly reported
the new file stale; the subsequent map refreshed it.

Graft-reported estimates across five retrieval calls: 99,292 + 14,687 + 11,358 +
103,710 + 104,352 = **333,399 tokens**. These are the tool's estimates, including
repeated maps, not measured billing savings; no estimate is claimed for checks.

## Limits and handoff

Pending app mutation probes roll back; setup users/sessions, houses/accounts,
draft fixtures, exact-replay setup and deliberate revocations remain synthetic
test data. Lead/reviewer should use the final database and retain the exclusive
mutation window discipline. No transaction/client from this script is left open.

This closes the data-layer revocation ordering defect, not the separate native
issuer/provider/transport, SlipOK/reference/slip/LINE, physical retention/restore,
production operation or release gates. Runtime app credentials remain trusted
server credentials; this does not prevent their holder from setting known actor
context. Natural clock expiry is checked at authorization; locking cannot stop
the clock, and this is not a guarantee that a previously authorized transaction
is asynchronously canceled at expiry. Independent security recheck is still
required before Lead accepts/integrates core data.
