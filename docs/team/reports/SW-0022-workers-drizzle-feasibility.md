# SW-0022 — Workers / Drizzle / Neon feasibility

Research date: 2026-10-13 (Asia/Bangkok)  
Repo: `ourhoomu` · branch `witchagorn/sw-0022-runtime-research` · baseline `f223f0d1137811951aff8ebaf6f1aba4e8da6d7e`  
Task `task_f1de27ad1c58` · Dispatch `ctx_9b62c8a6484c` · scope: this report only

## Decision summary

**Recommended lane for SW-0003/0004:** keep the user-selected Elysia + Cloudflare Workers + Neon + Drizzle stack, but treat the Elysia Workers adapter as an experimental compatibility surface and pin exact versions in SW-0003. Use Drizzle `neon-serverless` / Neon `Pool` with a short-lived connection created, connected, used, and closed inside each Worker request for interactive transactions, actor `SET LOCAL`, and row locks. Keep `neon-http` for independent reads and fixed, predeclared non-interactive transactions only. If Worker runtime smoke demonstrates Pool/WebSocket incompatibility or unacceptable operational behavior, evaluate one guarded PostgreSQL routine per atomic operation over HTTP as a fallback; do not split reserve/finalize into uncoordinated HTTP calls.

This is **source feasibility, not runtime proof**. No dependencies were installed; no Worker, Wrangler smoke, isolated database, SQL, or concurrency tests were run. Elysia itself labels the Workers adapter experimental. The official Neon driver documentation supports the transaction model but cautions that Worker WebSocket objects are request-scoped and suggests considering Cloudflare Hyperdrive. Hyperdrive is not adopted in this recommendation: verify its Neon connectivity, Free-plan availability/cost, and transaction/session behavior before treating it as an alternative.

## Compatibility and evidence matrix

| Area | Official-source finding | Planning consequence / unresolved proof |
|---|---|---|
| Elysia Cloudflare adapter | Elysia describes its Cloudflare Worker adapter as **experimental**. Its integration guide requires `CloudflareAdapter`, `.compile()` before exporting, Wrangler, and `compatibility_date >= 2025-06-01`. | Pin Elysia and Wrangler versions; verify bundle/startup and request handling under `wrangler dev`'s `workerd`. Keep a fallback option open until smoke is green. |
| Elysia runtime limitations | Elysia lists `Elysia.file` and Static plugin as unsupported, OpenAPI Type Gen as unsupported due to `fs`, and plugins that create `Response` before server start as unsupported. Static assets should use Wrangler's `assets` binding. | Build only APIs; avoid filesystem-dependent runtime plugins and eager response construction. Confirm chosen CORS/JWT/OpenAPI/error plugins against Workers with representative requests. |
| Elysia plugin compatibility | Core Elysia plugin composition is documented, and official plugin pages cover CORS/JWT/OpenAPI etc.; the Workers guide does not certify every plugin. Historical Elysia guidance explicitly notes not all official plugins were runtime-neutral. | Treat each chosen plugin as a separate compatibility row tested in the actual Worker bundle. Prefer Web APIs and request-time initialization; don't infer compatibility from Bun execution. |
| Bun versus Workers | Bun is the package manager/tooling choice confirmed by R17. Cloudflare says production Worker code executes in `workerd`; Wrangler local development also uses the Workers runtime model, not Bun's application runtime. | Bun install/typecheck/script success is not runtime evidence. `bun run` may launch Wrangler, but acceptance must observe the Worker in Wrangler/workerd. |
| Compatibility date / Node APIs | Elysia documents minimum date 2025-06-01 and says its adapter does not require `nodejs_compat`. Cloudflare's newer Node compatibility defaults vary by compatibility date, so dependency use still needs explicit inspection. | Start with the documented minimum date or later date selected by SW-0003; add flags only for proven dependency needs. Do not depend on Bun or unrestricted Node built-ins. |
| Drizzle Neon HTTP | Drizzle says HTTP is faster for single, non-interactive transactions; Neon HTTP `neon()` sends one query per request. Its `sql.transaction([...])` can batch fixed queries in one non-interactive transaction. | Good for independent reads and predetermined batches, not for read/decide/write loops requiring a row lock or a value from an earlier query. A fixed transaction batch is still atomic, but cannot interleave application decisions. |
| Drizzle Neon WebSocket | Drizzle `neon-serverless` wraps Neon `Pool`/`Client` and provides session/interactive transaction support. Neon warns a Worker WebSocket cannot outlive a single request; create/connect/use/end the Pool/Client inside that handler and do not reuse it globally. | Best fit for the current lock/read/compare/write contract. Check `pool.end()`/`client.end()` behavior and ensure all paths close even after exceptions. Avoid module-global live sockets. |
| Drizzle transaction API | Drizzle documents transaction APIs, but driver/runtime mechanics remain those of its selected Neon driver. | Test generated SQL and `tx.execute(sql`SET LOCAL ...`)` on the chosen version; ORM API existence alone does not prove Worker transport semantics. |
| SQL routine over HTTP | PostgreSQL can execute one function call as a single query; an appropriately designed routine can own all actor check, lock, available calculation, state transition, and ledger writes. | Viable fallback only if the routine is the complete atomic boundary, actor is passed from verified server context and revalidated, and app role cannot bypass it with direct DML. This is proposed for specialist review, not a confirmed decision. |
| Cloudflare local test model | Cloudflare's Wrangler documentation states Worker execution uses `workerd`; testing docs cover integration testing against Workers. | Use `wrangler dev`/the supported local Worker test harness to exercise actual runtime APIs; a Bun unit test is supplementary only. |

Sources below were opened on **2026-10-13**. Elysia's guide is a moving documentation page and calls the adapter experimental; exact package versions are not stated there, so SW-0003 must record the resolved versions and rerun proof when they change. Cloudflare and Drizzle docs are also rolling docs. Neon repository README is the driver's primary maintainer source (`neondatabase/serverless` main branch), but not a release-pinned specification; pin the actual installed driver before implementation.

## Transaction and actor-context recommendation

The proposed database design requires a single transaction for actor/membership checks, reservation accounting, confirmation uniqueness, and the relevant bill/share locks. PostgreSQL documents `SET LOCAL` as transaction-scoped and row locks as held to transaction end. Therefore, setting a session variable in one HTTP query and doing work in another is unsafe: the calls may not share a backend session or transaction, and `SET LOCAL` outside a transaction has no effect. A connection/session operation is needed unless every step is encapsulated in one SQL function call.

Preferred interactive flow (pseudocode, not implemented):

1. Authenticate the request at the API boundary and derive the actor UUID only from the verified session; ignore caller-supplied actor/house authority fields.
2. In the request handler, construct a short-lived Neon `Pool` or `Client`; acquire one client and begin a database transaction.
3. Set transaction-local actor context using a parameterized `set_config('app.actor_id', $1, true)` (or reviewed equivalent). The third argument makes it transaction-local. Never concatenate actor text into SQL.
4. Invoke the typed routine for the operation, or execute the reviewed SQL sequence using the same transaction/client. The database routine/policies revalidate active user and live membership; actor context is not a substitute for membership checks.
5. For reserve: acquire idempotency record first, then lock house/bill/share in the agreed global order; recalculate confirmed total and live reservations; compare requested amount to available; insert attempt/reservation and event atomically. Exact idempotent replay returns the prior attempt.
6. For finalize: make provider network call **before** acquiring money locks. Then begin a fresh short transaction, lock replay-policy singleton where applicable, house, bill, share, and attempt in the project-defined order; recheck attempt status/generation/expiry, amount, recipient and bank reference; insert the globally unique transfer claim and confirmation; release reservation and write event/outbox atomically. If the new available amount is insufficient or a gate fails, record `needs_attention`/blocked reference per the accepted contract and do not credit or enqueue LINE.
7. Commit, return only the authorized DTO, and close/release/end the request-scoped connection in `finally`. On transaction/deadlock/serialization failure, roll back and retry the entire idempotent operation only within a bounded policy; do not retry individual writes without rereading state.

The critical invariant is `confirmed + active reservations <= share amount`. Reservation and finalization paths that use different idempotency keys still serialize on the same share row. Unique constraints remain the final duplicate defense; row locks coordinate the read/compare/write decision. Keep provider calls and user waits outside the transaction to avoid holding locks. Lock rows in the same global order across API and maintenance routines to reduce deadlocks.

**HTTP-only fallback:** expose one narrowly scoped SQL function per atomic action (e.g. `reserve_payment(...)`, `finalize_transfer(...)`). Each function must establish/validate actor context within its own transaction, acquire locks, recompute availability, enforce idempotency/unique constraints, write all state and return an outcome. Call the single function over HTTP. Do not issue `SET LOCAL`, SELECT/compare, then separate INSERT/UPDATE HTTP calls. This fallback may simplify request-scoped sockets but pushes more trusted behavior into reviewed SQL and remains unproven for the chosen Drizzle/Neon versions.

RLS note: policy semantics and role grants belong to SW-0004. The runtime must connect with the restricted application role, not migration/admin credentials. If RLS depends on `current_setting('app.actor_id', true)`, test both an explicitly set actor and the missing/empty actor case; absent actor must expose no tenant data. If a `SECURITY DEFINER` function is selected, pin `search_path`, revoke `PUBLIC`, grant only `EXECUTE`, and ensure no direct application-role DML bypass. These are requirements for proof, not claims that current schema/RLS exists.

## Failure modes to exercise

- Request exits or throws before commit: all writes roll back; connection is closed; no partial reservation, credit, event, or outbox.
- Worker request ends while WebSocket transaction is active: transaction aborts or is safely rolled back; retry with same idempotency identity returns one resource.
- Two reservations race using different keys against one share: serialized availability means their sum cannot exceed share.
- Cash confirmation races with verified transfer finalization: exactly one path wins available balance; losing operation returns conflict/needs_attention without excess credit.
- Same transfer/reference is finalized twice or concurrently: unique global reference plus attempt/confirmation uniqueness permits one credit; exact replay returns original result without duplicate LINE event.
- Provider response arrives after reservation timeout: recompute fresh available; do not assume reserved amount remains available; over-cap result becomes needs_attention/blocked reference according to approved policy.
- Wrong, missing, empty, stale, or forged actor context; inactive/removed membership; cross-house IDs: reject and verify RLS fails closed.
- Deadlock/serialization/network timeout during commit: bounded full-operation retry with same key; uncertain commit resolves by querying idempotency record, never blindly creates a new attempt.
- Pool leak/reuse across Worker invocations: ensure no module-global connected Pool/Client and that normal/error paths close all resources.
- Adapter/plugin mismatch under `workerd`: missing APIs, startup response behavior, filesystem access, or Node builtin imports fail build/startup/route tests rather than silently falling back to Bun.

## Reproducible proof plan for SW-0003 and SW-0004

This is a plan only. Use a new **isolated Neon branch/database with synthetic fixtures and no production data**, a restricted application database role, and a separate migration role for schema setup. Do not point the smoke harness at the linked production branch. Record exact Node/Bun, Elysia, Wrangler, Drizzle, `@neondatabase/serverless`, PostgreSQL and Neon branch versions/IDs without credentials.

### SW-0003: runtime/toolchain smoke

1. Pin tool versions and commit package manifests/lockfiles under the API owner. Configure Wrangler with Elysia's documented `CloudflareAdapter`, `.compile()`, and compatibility date at least `2025-06-01`; configure only required bindings/secrets, with local secrets supplied out of band.
2. Run install from the committed lockfile and typecheck/build scripts; record exact commands and exit codes. These show toolchain reproducibility, not runtime acceptance.
3. Start `wrangler dev` (or the documented Worker integration harness) and hit `/health`, validated JSON, malformed-input/error, and representative middleware routes over localhost. Confirm requests execute in `workerd`, not Bun's server.
4. Include the exact intended plugin set (minimum auth/JWT, CORS, schema validation, OpenAPI if required, error handling); test valid/invalid bearer, preflight, validation rejection, headers, and cold startup. Remove or replace incompatible plugins; do not count a bare Hello World as plugin compatibility proof.
5. Confirm no runtime filesystem-dependent behavior; `Elysia.file`, Static plugin, OpenAPI Type Gen and eager `Response` are excluded or replaced with Workers-native assets/runtime behavior.
6. If using Neon WebSocket, issue a single health query and an explicit transaction-local actor query inside a Worker request; force an exception/rollback, make a second request with a different actor, and verify there is no context leak. Ensure the request-scoped Pool/Client closes after success and failure.

### SW-0004: isolated PostgreSQL and concurrency smoke

1. Create/reset the isolated Neon branch; apply reviewed migrations from a clean database with migration credentials. Seed only synthetic house/member/bill/share rows. Create a restricted runtime role and test as that role, not as owner.
2. Through the Wrangler Worker route and the actual chosen Drizzle driver, test: no/malformed/bad session → 401; authenticated actor with live membership → only own-house rows; forged actor/body UUID, cross-house object ID, removed membership, no actor GUC → deny; application role cannot perform direct protected-table DML. Include a second tenant to detect leakage.
3. Verify the transaction-bound GUC inside and outside the transaction: in the request transaction, actor is visible and RLS allows only permitted rows; after commit/rollback and on the next request, the old actor is absent. A missing actor must fail closed. Confirm parameterization rather than interpolated SQL.
4. Reserve on a synthetic share, then race `N >= 20` parallel reserve requests (include different idempotency keys) whose aggregate requested amount exceeds remaining. Assert exactly one resource per unique key, no sum of active reservations plus confirmations above share, and deterministic replays for repeated keys.
5. Start from a controlled remaining amount; synchronize two finalize requests (one cash, one transfer) behind a test barrier so they contend on the same share. Assert at most one consumes the remaining capacity, one confirmation per attempt, ledger total never exceeds share, and only committed confirmations have one event/outbox row. Repeat with same transfer reference submitted to two attempts and assert the global unique claim allows one credit.
6. Inject failures after each logical step (after lock, after claim insert, after confirmation insert, before commit) and kill/abort the request; verify rollback leaves no partial credit/outbox and idempotent retry converges to one result. Exercise deadlock/timeout and bounded whole-transaction retry.
7. Repeat critical concurrency tests through the actual Wrangler runtime path, not only a direct DB script. Capture request IDs, SQL state/error class, before/after aggregate totals, and database rows sufficient to audit the invariant without exposing secrets.
8. Reset or delete the isolated branch after evidence capture; record that this is synthetic-only. Run no product data writes against production.

Acceptance should require both transport lanes if both are retained: basic independent read via HTTP and the critical reserve/finalize sequence via the selected atomic lane. If SQL-routine fallback replaces WebSocket, rerun the full failure and race matrix through its HTTP function call. Runtime smoke is a prerequisite to SW-0004 acceptance; it does not prove external Google/Apple, SlipOK, LINE, or iOS integration.

## Blockers and handoff to Tech Lead

1. **Do not mark compatibility proven from docs.** SW-0003 must produce actual locked versions and Wrangler/workerd evidence. Elysia currently labels the adapter experimental.
2. **SW-0004 must choose actor identity and RLS contract.** SW-0024 owns auth/session research; coordinate the verified actor source before creating final policies or grants.
3. **Choose WebSocket interactive transaction versus complete SQL routines only after smoke.** Recommended initial proof: request-scoped Neon Pool/Client + Drizzle `neon-serverless`; HTTP routines remain contingency, not a shortcut to split writes.
4. **Cloudflare Hyperdrive is an unassessed official alternative.** Neon suggests considering it for Workers. Lead/platform should check current Neon support, compatibility with Neon/transaction semantics, Free plan eligibility/pricing and whether it changes connection lifetime before pursuing.
5. **Database design still has pending product/operational gates** (design approval, creator self-confirm for cash, reservation TTL/late result behavior, replay floor and actor/auth design). Do not quietly turn these proposals into accepted policy while implementing smoke fixtures.
6. Use only an isolated synthetic branch and restricted app role. Production Neon is explicitly outside this task; no migrations, product rows, deployment, or packages were changed here.

## Source notes (primary/official; opened 2026-10-13)

- Elysia, [Cloudflare Worker integration](https://elysiajs.com/integrations/cloudflare-worker) — experimental adapter, required export/config, limitations, bindings; moving docs, no release-pinned version on page.
- Elysia, [Plugin overview](https://elysiajs.com/plugins/overview), [CORS plugin](https://elysiajs.com/plugins/cors), [JWT plugin](https://elysiajs.com/plugins/jwt), and [OpenAPI plugin](https://elysiajs.com/plugins/openapi) — official plugin catalog/configuration; none certifies all plugin/runtime combinations for Workers.
- Drizzle, [Neon connection guide](https://orm.drizzle.team/docs/connect-neon) and [transactions](https://orm.drizzle.team/docs/transactions) — `neon-http` versus `neon-serverless` driver guidance and ORM transaction interface; rolling docs, version selected later.
- Neon maintainer source, [`neondatabase/serverless` README](https://github.com/neondatabase/serverless) — HTTP single queries/fixed non-interactive transactions; Pool/Client interactive session semantics; Worker WebSockets are request-scoped and must be closed; suggests considering Hyperdrive. Main branch is mutable; pin package release during SW-0003.
- Cloudflare, [Wrangler install/update](https://developers.cloudflare.com/workers/wrangler/install-and-update/), [Workers testing](https://developers.cloudflare.com/workers/testing/), [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), and [WebSockets](https://developers.cloudflare.com/workers/runtime-apis/websockets/) — Wrangler and `workerd` testing context, compatibility caveats. Rolling docs; local simulation is not proof of deployed Cloudflare quota/region behavior.
- PostgreSQL 18, [`SET`](https://www.postgresql.org/docs/18/sql-set.html) and [explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html) — `SET LOCAL` ends with transaction and `FOR UPDATE` locks rows to transaction end. `current` resolved to version 18 when opened; project records Neon PostgreSQL 18.

## Execution record

- Baseline/branch: `f223f0d1137811951aff8ebaf6f1aba4e8da6d7e` / `witchagorn/sw-0022-runtime-research`.
- Graft: **ACTIVE**; version 0.21.1; exact worktree `/Users/afe/orca/workspaces/ourhoomu/sw-0022-runtime-research`; `graft build --no-gitignore --no-ignore` succeeded: 110 nodes, 293 edges, 26 cards; cache replayed from `/Users/afe/Desktop/ourhoomu` and written to local ignored `graft/`. No Graft retrieval calls were needed because this task researched official sources and repository Markdown, not indexed application logic; no token-savings estimate was reported by a retrieval call, so savings are **not reported**.
- No dependencies installed, tests run, isolated DB created, migration applied, Wrangler invoked, production accessed, or application/config/ticket files modified.
- Report verification: pending `git diff --check` and review in this dispatch. Runtime compatibility and all SW-0003/0004 smoke acceptance remain pending.
