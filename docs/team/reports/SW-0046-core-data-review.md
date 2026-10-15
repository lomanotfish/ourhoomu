# SW-0046 — frozen core data security review

Verdict: **changes_requested**. One reproducible session-revocation race remains;
the existing package, core database and session suites all pass. Lead owns
acceptance, fix routing, integration and ticket/checklist updates.

## Reviewed artifact and authority

- Frozen implementation: `e62d1ada148af967879ff271c49069d5af8367d1` (SW-0004),
  accepted wire contract/OpenAPI `7756bcc` (0.3.2).
- Review worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0046-core-data-review`.
  Dispatch `ctx_44b8f468e1e5`, task `task_d66a1424129f`; implementation remained
  unchanged. Only this report was written. The worker stopped at a final model refusal before commit or worker_done; Lead preserved the report and final-screen evidence, stopped/released the exact Dispatch and committed this report without accepting the implementation. The original writer's resources
  and `runtime_probe` were preserved.
- Read project AGENTS, requirements, board, core implementation authorization,
  domain/database/API/core API contracts, SW-0004 ticket/report and SW-0046 ticket
  (`git show e3a8b89:docs/team/tickets/SW-0046.md`, absent at frozen HEAD).
- `/Users/afe/.codex/agents/security-engineer.toml` is absent. Coordinator's
  durable message `msg_a2aa4b705890` explicitly authorizes the inline security
  reviewer role and report-only continuation. No nested agents were used.
- Session permissions are explicitly `approval_policy=never` and
  `sandbox_mode=danger-full-access` in the supplied runtime instructions; no
  inference about an absent role profile's launch configuration is made.

## Finding F1 — P2: revoked actor can create a house after a lock wait

**Location:** `ourhoomu-api/drizzle/0001_core_operations.sql:82` initializes
`uid := core.actor()`; lines 91–98 validate it, then wait for the user row for
`house.create`, account commands and `session.revoke`. There is no subsequent
actor check before replay (162–169) or the house insert (175–179).
`CoreDatabase.withPrincipal` checks the actor before invoking the callback
(`src/db/connection.ts:85`), so it does not close this later wait window.

**Observed:** while a real restricted-app `house.create` waited on the user row,
the separate verifier committed family revocation. Access verification then
failed. Releasing the row lock let the command return a new house resource ID,
although `select core.actor()` on the same runtime transaction returned NULL.
The app transaction was rolled back: no probe house or idempotency record was
committed. This allows an already revoked session to mutate after an arbitrarily
long user-lock wait; the same missing post-wait check affects the account branch.
The house-bound path does re-evaluate `core.member()` after its house lock
(`0001_core_operations.sql:52`), which rechecks the session.

**Durable minimal reproduction:** use `issue()` in
`scripts/db/check-sessions.ts:14` to create one synthetic session using the
guarded verifier URL. Retain returned `claims.userId`, `claims.sessionId` and
`accessDigest`. Open distinct owner, app and verifier connections from
`loadTarget()`; use random SHA256 request-key and body digests. Run these steps
in order, holding the owner transaction until step 4:

1. Owner: `BEGIN; SELECT id FROM core.users WHERE id=$1 FOR UPDATE`, parameter
   `claims.userId`.
2. App: `BEGIN`, set transaction-local `ourhoomu.user_id` and
   `ourhoomu.session_id` to those claims, then start (without awaiting):
   `SELECT core.command('house.create',NULL,NULL,$1::jsonb,$2,$3)` with
   `{"name":"SW0046 rollback-only","timezone":"Asia/Bangkok"}` and the digests.
   Set a 15-second local statement timeout. Confirm the app backend is waiting
   using owner `SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1`
   and the app's previously obtained `pg_backend_pid()`; expect `Lock`.
3. Verifier: `SessionStore.execute('revoke', {sessionId: claims.sessionId})`;
   await completion, then assert `verifyAccessDigest(accessDigest)` rejects.
4. Owner: `ROLLBACK`. Await the app command: frozen implementation returns
   success and a resource ID. App: `SELECT core.actor()` returns NULL.
5. App: `ROLLBACK`; release all clients. Keep revocation committed.

Actual guarded probe command:
`bun /tmp/sw0046-revocation-probe.ts` with the two path variables below.
It printed `REPRODUCED: revoked session house.create succeeds after user-lock
wait; actor is now null; rolling back` and exited 0. The sequence above is the
durable reproduction; `/tmp` scripts are not delivery dependencies.

**Requested correction:** data owner must revalidate the session after blocking
scope locks and before replay/mutation in the non-house branch, and audit other
blocking paths against the intended revocation ordering. Add a deterministic
restricted-app regression using this lock/revoke/unblock ordering, covering
house creation and account mutation. It must reject with `unauthenticated` and
leave no command, replay locator or event. Preserve canonical lock ordering;
do not repair this by acquiring session locks in inconsistent orders.

## Commands, roles and observed results

All database commands used only these explicit private paths; values were never
printed or sourced from root `.env`/Neon linked production:

```sh
export SYNTHETIC_DB_ENV_FILE=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env
export NEON_BRANCH_RECEIPT=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json
cd ourhoomu-api
```

The existing guard validated project `lucky-bar-14515304`, branch
`br-weathered-thunder-b38dgxbm`, endpoint `ep-dry-breeze-b3e8t69s`, schema-only
receipt, explicit restricted roles, direct owner URL and expiry. App/auth URLs
came from separate `CORE_APP_DATABASE_URL` / `CORE_AUTH_DATABASE_URL` keys in
that private file. No migration/reset/drop/rehearsal, provider call, push or
deployment was performed.

| Command/check | Role and fresh result |
| --- | --- |
| `bun install --frozen-lockfile` | Bun 1.4.3; 79 installs checked, no changes. |
| `bun run format:check`; `bun run lint`; `bun run typecheck` | All passed; 24 formatted/linted files, no fixes/suppressions. |
| `bun run test` | 10 pass, 0 fail, 35 assertions, five files. |
| `bunx drizzle-kit check` | Passed. |
| Drizzle generation against a temporary copy of `drizzle/` | 21 tables; no schema changes, nothing to migrate. Original schema/snapshot/config unchanged. |
| `bun scripts/db/check.ts` | Actual app/auth/owner connections; all 21 groups passed. |
| `bun scripts/db/check-sessions.ts` | Actual auth/app/owner connections; all four groups passed. |
| `bun /tmp/sw0046-catalog-probe.ts` | Owner catalog inspection; all three role flags, ownership, grants and private-column assertions passed. |
| `bun /tmp/sw0046-viewer-probe.ts` | Actual app credential; three separately issued synthetic verifier sessions; house/account/bill commands in one app transaction, always rolled back. Creator-nonpayer denied destination, recipient and owing payer allowed, activity contains neither ciphertext nor masked destination. |
| `bun /tmp/sw0046-revocation-probe.ts` | Actual app blocked by owner fixture lock, verifier revoked; reproduced F1, app mutation rolled back. |
| `git diff --check`; `graft check` | Whitespace passed; wiring graph in sync. |

Parity reproduction without writing the checkout: copy `drizzle/` into a temp
directory, place a JSON Drizzle config there with `dialect: postgresql`, `out:
./drizzle` and `schema` set to the frozen worktree's absolute
`ourhoomu-api/src/db/schema.ts`, and run the installed
`ourhoomu-api/node_modules/.bin/drizzle-kit generate --config ./config.json`
from that directory. An initial absolute `out` attempt hit Drizzle Kit's
`.//absolute-path` resolution error; using relative `out` in the temp cwd passed.
The custom migration deliberately adds constraints, indexes, routines and
policies beyond the generated snapshot; generation parity does not replace
their catalog/source review.

## Coverage and evidence map

| Boundary | Source / committed regression evidence and conclusion |
| --- | --- |
| Schema and same-house FKs | `src/db/schema.ts`, `drizzle/0000_core_schema.sql`, custom migration:13–29; 21-table generation parity and actual owner cross-house insert rejection (`check.ts:602`). Composite tuples cover house/member, bill/share/attempt/credit, schedule/revision/occurrence and activity parents. |
| Default deny and authority | `0001_core_operations.sql:551–596`, `check.ts:101–142`: all 21 tables enable+force RLS; all routines writer-owned with fixed `pg_catalog` search path and no PUBLIC EXECUTE. Independent catalog asserts no app/auth table INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER, no writer membership, no core table ownership; writer NOLOGIN, all three roles lack superuser/BYPASSRLS/CREATEDB/CREATEROLE. Actual app bootstrap, session reads and SET ROLE writer denied. Private bank ciphertext/digest/key/user columns and invite digest not granted. |
| Session and pooled context | `connection.ts:85–121`, `0001_core_operations.sql:35–60,402–456`; session suite proves single-use challenge, exact concurrent rotation, old access denial, committed different-reuse revocation despite caller receiving unauthenticated, logout precedence, five-minute expiry and expired-principal rejection. Core suite forced rollback proves no command data/context leak (`check.ts:772`). F1 is the uncovered wait race. |
| Locks, expiry and replay | House-first `require_member`, bill → share → attempt, ordered shares, then idempotency/credit/event; account commands use user scope and publish locks account under house/bill. Session family locks root first, then generations. Replay scope includes actor/operation/house/resource/key and exact body hash (`0001:162–169,394`); fresh membership and parent expiry precede child replay. Core tests cover removal-before-existence/expiry/replay, parent caps and bounded whole-transaction retry. |
| Money and immutable cash credit | `0001:238–310`, schema checks and `check.ts:200–395,609–743`; exact numeric largest remainder/BigInt, MAX_SATANG, invalid bps/duplicate members atomic rejection, 20000 example/self-covered without credit, 4000+6000 cash, pending not credit, creator-only and creator-as-payer audit, same-key convergence and distinct-key races, no runtime credit UPDATE/DELETE path. Reservation races/TTL/releases/caps and uncapped exact dashboard sum verified. Transfer cannot gain credit through cash routine. |
| Invitations, owner guard, account publish | `0001:99–110,181–237,257–274`; concurrent one-consume and already-member non-consumption, last-owner concurrent leave, five-minute replay/full invitation issuance dedup including 25-hour retry, stale account version and account-update/publish race all pass (`check.ts:334–442,573–600`). |
| Chores and activity | `0001:311–390,514–528`, schema unique constraints; committed checks cover assignee-only transitions, unique completion version, 14-day preview, 30-day generation, ordered rotation/date validation, revisions preserving completed rows and schedule/date identity, leave unassignment, monotonic visible cursor. Activity schema/projections contain references and event summaries, no bank/provider payload. Extra private-viewer probe passes. |
| Encrypted replay | `src/db/replay.ts`, `tests/db/replay.test.ts`, `connection.ts:54`; AES-GCM random nonce and actor/route/key authenticated scope, tamper/scope rejection, server HMAC key digest and exact-body SHA256. SQL admits encrypted envelopes only through trusted backend inputs and limits replay access to five minutes. Fixture envelopes are fake and do not establish production key management. |

Independent catalog negative probes were `has_table_privilege` over every core
table × app/auth role × DML privilege (zero), `pg_has_role(...,writer,'MEMBER')`
(false), `has_column_privilege` for snapshot secrets and invitation digest
(false), identity/session/idempotency table SELECT checks (false), role flags
and `runtime_probe` namespace existence (one). The viewer probe used normal
commands and three current synthetic actors; initial attempts to reuse old
fixture sessions found none live, and owner SET ROLE app/auth was correctly
denied. It was rerun successfully with fresh sessions and the actual app URL.

## Core versus full gates

F1 blocks this review's core approval until fixed and independently retested.
Passing core schema/cash/expiry checks is not full SW-0004 acceptance. Global
transfer-reference deduplication, private slip storage/uploader-recipient
streaming, SlipOK/LINE/provider behavior, replay floor, physical purge/backups
and restore fencing remain SW-0037/SW-0007/SW-0013 gates. Live native
Google/Apple/Managed Auth verification, transport handlers/DTO projections and
deployed Workers/iPhone/TestFlight acceptance are not proved by these synthetic
trusted-verifier/data-layer tests. No status/checklist changes were made.

## Graft and handoff

**Graft: ACTIVE** — Graft 0.21.1 in this exact worktree; `graft map` returned
51 indexed files/194 symbols/537 edges; scoped `graft ask` located transaction
and session boundaries; final `graft check` reported wiring graph in sync,
245 nodes, deep layer intentionally not built. Raw fallback used for unindexed
Markdown/SQL/config and exact source spans beyond retrieval truncation. Two map
calls reported 99,292 tokens saved each and one ask 11,937: reported total
210,521 across three retrieval calls (tool estimates, including repeated map;
not measured session billing savings). No savings claimed for `check`.

Next owner: Lead routes F1 to data owner, preserves the frozen review evidence,
requests deterministic regression coverage and independently re-runs required
checks after the fix. This report does not change acceptance or authorize any
external operation.
