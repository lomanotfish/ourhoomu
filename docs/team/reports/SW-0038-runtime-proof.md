# SW-0038 — Elysia/Workers/Neon runtime proof

Date: 2026-10-13 (Asia/Bangkok). Worktree `sw-0038-runtime`, branch `witchagorn/sw-0038-runtime`, starting HEAD `44dcb2c2c05f37f4d22473cfba9ddd1c7a0b6e44`. Original platform Dispatch `ctx_52fa55b57817` failed with `operator_close` before `worker_done`; its uncommitted work was preserved. Tech Lead took the sole writer role in the same isolated worktree and completed the proof. This report replaces the original provisional report, which incorrectly treated endpoint mapping as unavailable.

## Delivered

- Isolated `ourhoomu-api` package: pinned Bun/Elysia 1.4.30/Drizzle 0.45.4/Neon serverless 1.2.0/Wrangler 4.150.0/TypeScript 7.0.2, package lock, Workers production entry, request-scoped response envelope, 400/401 validation and CORS. Wrangler configs are inside the API package. The production entry contains no DB fixture route or client-supplied actor route.
- The test-only entry imports `env` from `cloudflare:workers`, as documented by Elysia and Cloudflare, and creates a Neon `Pool` per request. Inside an actual Drizzle interactive transaction it sets `app.actor_id` with a parameterized `set_config(..., true)` call and queries a policy-protected table. The fixture role is separate from the branch owner and lacks superuser, BYPASSRLS and CREATEROLE.
- `tests/fixtures/prepare-neon-runtime.ts` verifies the branch-create receipt against private credential metadata before applying fixture SQL or writing ignored, mode-600 `.dev.vars`. `tests/fixtures/check-neon-runtime.ts` runs the repeatable live proof and read-only role/rollback assertions. No credential value is committed or printed.

## Synthetic target and proof

The authorized target was new schema-only Neon branch `dev-core-sw0036-20261013` (`br-weathered-thunder-b38dgxbm`) with endpoint `ep-dry-breeze-b3e8t69s`, expiring 2026-10-20. Lead's private, ignored `branch-create.json` maps the endpoint to that branch. `synthetic-db.env` was mode 600; its direct owner URL and derived restricted URL both targeted the assigned endpoint. Neither linked production `br-shy-frog-b30wrl6l` nor pre-existing developer branch `br-lively-bonus-b3x0v2uu` was used.

The fixture created `runtime_probe.visible_rows` with two synthetic actors and `runtime_probe.rollback_probe`, enabled and forced RLS, and granted the restricted role only the permissions needed by the fixture. Through Wrangler's local `workerd`, actor A received only actor A's row, actor B only actor B's row, then an A request deliberately inserted and threw. Its 500 response was followed by a B request with only B's row. Owner read-only verification found zero rollback rows; restricted-role read without actor returned zero visible rows. Every successful request returned empty outside-transaction actor context. The role inspection found `rolbypassrls=false`, `rolsuper=false`, `rolcreaterole=false`.

## Commands and results

From `ourhoomu-api/`:

| Command / check | Observed result |
|---|---|
| `bun install --frozen-lockfile` | exit 0; 61 installs checked, no changes |
| `bun run typecheck` | exit 0 |
| `bun run test` | 3 pass, 0 fail, 6 assertions |
| `bunx wrangler dev --config wrangler.jsonc --ip 127.0.0.1 --port 8787` and `bun run check:runtime` | actual `workerd`: health 200, validation 400, missing credential 401, CORS 204; UUID request ID matched body/header |
| `bun run prepare:neon-runtime` with private file paths, then `bunx wrangler dev --config wrangler.runtime.jsonc --ip 127.0.0.1 --port 8787` and `bun run check:neon-runtime` | actual `workerd` + synthetic Neon: two actors, restricted RLS, forced rollback, empty context and next-request isolation passed |
| `bunx wrangler deploy --dry-run --config wrangler.jsonc --outdir /tmp/sw0038-final-dryrun` | exit 0; production bundle 847.47 KiB, gzip 156.19 KiB; no deploy |
| `git diff --check` | exit 0 |

Both Wrangler processes were stopped and ignored `.dev.vars` removed after proof. The synthetic branch/fixture is retained temporarily for data work, with its expiry and cleanup owned by the Lead. A local `workerd` proof does not establish remote Cloudflare deployment, mobile native behavior, live issuer identity, provider verification or release readiness.

## Graft and sources

Original worker `graft build --no-gitignore --no-ignore` initially indexed 26 files/110 nodes/293 edges. Lead's `graft map` during recovery covered 32 indexed files/91 symbols/317 edges; four `graft skeleton` calls plus the map reported approximately **34,702 tokens saved** for Lead retrievals. Final exact-worktree `graft build --no-gitignore --no-ignore` and `graft check` indexed 34 files/126 nodes/326 edges and passed. **Graft: ACTIVE** for code; Markdown, config and SQL used raw fallback. No token estimate is inferred for the original worker.

- [Elysia Cloudflare Worker integration](https://elysiajs.com/integrations/cloudflare-worker) documents the experimental adapter, `.compile()`, compatibility date and `cloudflare:workers` binding import.
- [Cloudflare Workers bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/) documents `env` access and binding lifetime.

## Acceptance boundary

The scoped runtime proof is ready for independent review and Lead integration. Full SW-0003 foundation still needs the accepted final SW-0036 contract and domain routes. The API package's development validation route is a bounded common-envelope proof, not an authenticated product endpoint. External credentials, native Apple/Google, SlipOK, LINE, production migrations/deployment and complete retention remain separately gated.
