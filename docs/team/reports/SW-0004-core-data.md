# SW-0004 core data delivery — 2026-10-14

Worker result for Lead review, not full ticket acceptance. Task `task_4c7e3785d472`,
Dispatch `ctx_c2b63e80f1fd`, Run `run_a401e29c745e`. Assigned worktree
`/Users/afe/orca/workspaces/ourhoomu/sw-0004-core-data`, branch
`witchagorn/sw-0004-core-data`, baseline `e14a0bc48dfd9e24e3fc6df9dbf8920263ea02ec`.
Frozen wire contract `7756bcc` / accepted 0.3.2. Final commit is in this Dispatch's
settlement receipt. No app registry/modules/frontend/contract/status edits.

| Area | Delivered / observed evidence |
| --- | --- |
| Schema | `ourhoomu-api/src/db/schema.ts`: 21 Drizzle tables for identity/challenge/session, house/member/invite/account, bill/share/snapshot/attempt/immutable cash credit, schedule/revision/ordered rotation/occurrence/completion, activity/cursor/idempotency. Composite house FKs, money/version/retention checks, supporting FK/expiry/feed/date indexes. |
| Atomic operations | `src/db/types.ts`, `connection.ts` and `drizzle/0001_core_operations.sql`: house/invite/member/account commands; draft/publish/void; reserve/confirm/reject/cancel; one-off chore/complete/reopen; recurring revision/generation; monotonic visible activity cursor. House → aggregate → ordered shares/attempts → idempotency/credit/event; fresh DB session and membership before child/replay. |
| Authority / grants | Actual pooled `ourhoomu_core_app`: no table DML, auth/bootstrap calls, private identity/session reads or SET ROLE writer; no-actor reads empty and command denied. All 21 tables enable+force RLS. Functions fixed `pg_catalog` search path, schema-qualified, no PUBLIC EXECUTE, owned by `ourhoomu_core_writer` (NOLOGIN, NOBYPASSRLS). Runtime is neither owner nor superuser/BYPASSRLS/CREATEDB/CREATEROLE. |
| Session / replay | Separate restricted `ourhoomu_core_auth` credential for trusted backend verifier. Single-use challenges, issuer+subject uniqueness, refresh family locks, encrypted five-minute exact replay, committed family revocation on other reuse, logout precedence. AES-GCM helper authenticates actor/route/key scope; exact-body SHA256 and server HMAC key evidence. |
| Money | SQL exact numeric allocation plus independently checked BigInt largest remainder; MAX_SATANG 900000000000, bps exactly10000, recipient self-covered without fake credit. Reservations cash24h/transfer30min, parent-capped. Immutable unique credit and explicit creator-as-payer audit; transfers cannot be confirmed by cash routines. Dashboard totals remain decimal strings above the per-bill cap. |
| Target / migrations | Explicit private receipt/env only; pin project `lucky-bar-14515304`, branch `br-weathered-thunder-b38dgxbm`, endpoint `ep-dry-breeze-b3e8t69s`, expiry2026-10-20T12:00Z. Owner direct migration; separate pooled app/auth URLs stored only in ignored mode600 env. `runtime_probe` schema/role preserved; no linked root config, production or pre-existing user dev branch used. |

## Verification

Run in `ourhoomu-api/`. Database commands require these **path variables**, not
credential values:

```sh
export SYNTHETIC_DB_ENV_FILE=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env
export NEON_BRANCH_RECEIPT=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json
```

| Exact command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | Pass; Bun1.4.3, only new direct dependency Drizzle Kit0.31.11. |
| `bun run format:check`; `bun run lint`; `bun run typecheck` | Pass, no suppressions. |
| `bun run test` | 10 pass, 0 fail, 35 assertions across5files; money, secure target, AES-GCM replay and existing runtime tests. New focused tests first failed for absent implementation, then passed. |
| `bunx drizzle-kit check` | Pass. |
| `bunx drizzle-kit generate --name reproducibility_probe` | No schema changes, nothing to migrate; no probe migration retained. |
| `bun scripts/db/migrate.ts rollback` then `bun scripts/db/migrate.ts up` | Empty-core rehearsal passes; only core dropped, probe preserved. Hardened role OIDs/credentials retained across rehearsals. Registered generated schema + custom routine migration applied atomically with SHA256 output. |
| `bun scripts/db/check.ts` | 21 groups pass; real restricted-role catalog/RLS/constraints/money/invite/owner/chore/rollback/expiry/race checks and EXPLAIN ANALYZE BUFFERS. |
| `bun scripts/db/check-sessions.ts` | 4 groups pass: concurrent exact refresh, different reuse revocation, logout race, replay expiry and expired session actor rejection. Synthetic verifier claims only. |
| `git diff --check` | Pass. |

`check.ts` covers: two-house isolation and SQL composite FK rejection; bps9999/
10001/duplicate members with no partial data; A/B20000satang with A10000
self-covered and Bcash4000+6000; pending not credit; same-key reserve/confirm
convergence and distinct-key concurrent confirm; creator-only cash/self-confirm
credit audit; account-version publish race; concurrent invite consumption and
already-member non-consumption; last-owner leave race; assignee-only transitions;
14-day preview/30-day generation uniqueness and future revision preservation;
25-hour invitation issuance retry409; concurrent overbooking rejection, rejection/
cancellation release and near-expiry parent caps; exact dashboard1350000000000
increment; bounded whole-transaction retry; visible monotonic cursor; rollback,
no actor leak, removal-before-expiry/replay and expired-parent denial.

Final migration SHA256: schema `bbdf30a4e26a4511cd118a47f6655c6228f227941cbdf41d6c99a848f924ec59`; operations `bc1f73c0add686fcf0376427a1799a9d700087c1a89ee3098464fdcf67bb8b45`.

Opaque payment routes use `resolvePaymentHouse` / `paymentById`: minimal internal
parent resolution checks fresh membership and mutations recheck under the
house lock; foreign or removed viewers receive hidden404. This seam was included
in the final migration and restricted-role check run.

## Decisions, retries and remaining gates

Lead approved 24-hour non-history locator retention and clarified canonical
house-first locking through Orca. Invitation issuance retains its semantic key
through7days; encrypted replay is only5minutes, later known key409. History keys
remain parent-capped through access expiry, at most own364days. After generic
locator expiry there is no cached-success guarantee; clients must refetch
uncertain writes before creating a new logical operation.

Rehearsal found and fixed transaction-clock `now()` defaults conflicting with
statement-time expiry calculations, a test fixture deadline arithmetic error,
a PL/pgSQL alias collision in the new cursor parent predicate, and a Drizzle
snapshot/default mismatch. Early DROP/CREATE roles left old authenticated
PgBouncer backends; only confirmed stale worker-created app/auth backends were
retired. Rollback now retains hardened role identities/credentials and later
rehearsals succeed without that recovery. Extra draft worktree
`sw-0004-core-data-impl` was created from the initial “NEW worktree” instruction;
Lead corrected ownership, drafts were copied to assigned worktree and the extra
was left unchanged for Lead cleanup. No merge or cleanup performed by worker.

Trusted verifier role can issue sessions **after** upstream signature/audience/
nonce verification; these tests do not prove native Google/Apple/Managed Auth.
Custom actor settings are a backend trust boundary, not protection against DB
credential holders. Feature handlers must project explicit frozen DTOs/action
flags and transport pagination; core adds no public product routes. Replay
access expires at5minutes and a verifier-only secret-cleanup primitive exists;
scheduling/physical DB/backup deletion evidence remains SW-0037. Global transfer
reference deduplication, private slip/provider/LINE tables and services, physical
purge/restore floor and deployment/native proof retain their original gates.
Full original AC3 and full ticket closure are **not** claimed. Next owner: Lead
for independent security/data review, acceptance, local integration and cleanup.

## Graft / runtime

Graft0.21.1 ACTIVE in the assigned exact worktree: build42files/159nodes/366edges
at initial assigned checkpoint; final retrieval refreshed changed code and
`graft check` reported wiring graph in sync (245nodes; deep layer intentionally
not built). Raw fallback was limited to docs/config/new files and pointed source
spans; no cache committed. Retrieval reported savings46332tokens across7calls
(including initial extra-worktree probes); two builds plus two freshness checks
have no claimed savings. Harness explicitly supplies never/danger-full-access;
role profile matches, and process inspection observed bypass launch flags,
without asserting a separately verified per-Dispatch argv receipt.

Official sources consulted before migration decisions:
[Neon driver](https://neon.com/docs/serverless/serverless-driver),
[Neon pooling](https://neon.com/docs/connect/connection-pooling),
[PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html),
[Drizzle generation](https://orm.drizzle.team/docs/drizzle-kit-generate), plus
installed neon/neon-postgres skills. Interactive WebSocket transactions and
owner-direct migrations follow those sources.
