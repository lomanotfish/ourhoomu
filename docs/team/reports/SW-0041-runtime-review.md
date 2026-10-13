# SW-0041 — independent review of SW-0038 runtime proof

Date: 2026-10-13 (Asia/Bangkok). Reviewed frozen commit `00c6583dababe92782567033d1180707e3b55680` against parent `44dcb2c2c05f37f4d22473cfba9ddd1c7a0b6e44` in worktree `sw-0041-runtime-review` (`witchagorn/sw-0041-runtime-review`). Verdict: **changes_requested**. The production route boundary and error handling need correction before integration. This is a review of SW-0038's bounded proof, not acceptance of SW-0003 or product routes.

## Findings

1. **P1 — The production entry exposes a test validation route with no real authentication.** `ourhoomu-api/wrangler.jsonc:4` selects `src/index.ts`, which creates the app at `src/index.ts:5-8`. That app unconditionally registers `POST /runtime/validate` at `src/app.ts:26-42`; `src/app.ts:27` only checks that an Authorization header exists. The `appEnv` argument is never used to restrict this route. In local `workerd` using the production Wrangler config, `POST /runtime/validate` with `Authorization: Bearer arbitrary` and a valid body returned **200** and echoed the value. SW-0038 says `/health` is the only public production route until features are accepted. Move this proof route to a test-only entry or remove it from the production app; assert that the production entry returns 404 for it. Do not treat the current `APP_ENV=development` Wrangler variable as a deployment boundary.

2. **P2 — The catch-all handler reports missing routes as server errors and returns raw exception text.** `ourhoomu-api/src/app.ts:43-50` maps every error outside validation/parse to 500 and serializes `error.message` into the response. A request to `/not-a-route` returned `500 {"error":{"code":"internal_error","message":"NOT_FOUND"},...}` in a local app fetch. This breaks the contract's unavailable-route 404 and risks disclosing driver or provider diagnostics when later routes throw. Handle `NOT_FOUND` as 404 and use a fixed public message for unexpected errors; keep diagnostic details in restricted logs keyed by request ID. The test entry has the same raw-message pattern at `tests/fixtures/worker.ts:81-95`, but it is only selected by `wrangler.runtime.jsonc`.

3. **P2 — The write-capable fixture target check accepts hostname prefixes.** `ourhoomu-api/tests/fixtures/prepare-neon-runtime.ts:23-31` allows its migration URL when `hostname.startsWith(NEON_ENDPOINT_ID)`, and `:64-68` does the same for the runtime URL; `tests/fixtures/check-neon-runtime.ts:42-49` repeats the check. A host beginning with the endpoint ID but continuing into another hostname passes the guard. Since the preparation script creates a schema and login role, validate the endpoint as an exact DNS label on an allowed Neon domain (and the required secure scheme) before connecting. The receipt/branch checks and private-file requirement are useful safeguards, but prefix matching does not itself prove the URL targets that endpoint.

## Verified behavior and boundaries

- Production bundling points at `src/index.ts`; the test DB route is present only in `tests/fixtures/worker.ts` selected by `wrangler.runtime.jsonc`. The production dry-run did not list a DB binding. `cloudflare:workers` env import, Cloudflare adapter, `.compile()`, and compatibility date `2025-06-01` align with the [Elysia Worker integration guide](https://elysiajs.com/integrations/cloudflare-worker) and [Cloudflare binding guidance](https://developers.cloudflare.com/workers/runtime-apis/bindings/).
- The test fixture uses a per-request Neon `Pool`, Drizzle interactive transaction and parameterized `set_config('app.actor_id', actor, true)` (`tests/fixtures/worker.ts:62-85`). The SQL enables and forces RLS and grants the synthetic login role limited schema/table permissions (`tests/fixtures/neon-runtime.sql:20-29`). The check script asks for two actor-specific rows, a failed write/rollback, a subsequent actor, no actor outside the transaction, no row without actor, and a role without superuser/BYPASSRLS/CREATEROLE (`tests/fixtures/check-neon-runtime.ts:62-100`). These are credible proof steps; I did not independently connect to Neon or rerun fixture writes.
- Package scripts and config live under `ourhoomu-api/`; `node:fs` appears in Bun-only fixture helpers, not the production Worker entry. The child `.gitignore` covers `.dev.vars`, `node_modules`, `.wrangler`, and `dist`. No credential value appeared in tracked files reviewed; the previous proof report says its private files and `.dev.vars` were removed, which I did not independently verify outside this worktree.

## Checks run in this worktree

| Check | Result |
|---|---|
| `bun install --frozen-lockfile` | exit 0; 61 packages installed from frozen lock |
| `bun run typecheck` | exit 0 |
| `bun run test` | 3 passed, 0 failed, 6 expectations |
| `bunx wrangler deploy --dry-run --config wrangler.jsonc --outdir /tmp/sw0041-review-dryrun` | exit 0; local bundle 847.47 KiB / gzip 156.19 KiB; no deploy |
| `bunx wrangler dev --config wrangler.jsonc --ip 127.0.0.1 --port 8787`, `bun run check:runtime` | local workerd started; health 200, validation 400, missing credential 401, CORS 204; process stopped |
| Direct local `POST /runtime/validate` with `Bearer arbitrary` | 200, confirming finding 1 |
| Local app fetch of `/not-a-route` | 500 with `NOT_FOUND` in public message, confirming finding 2 |
| `git diff --check` before report | exit 0 |

No format script is defined in `ourhoomu-api/package.json`, so there was no package format check to run. I did not run the Neon preparation or live DB checks because this review has no private credential paths and permits no DB writes. The claims in `docs/team/reports/SW-0038-runtime-proof.md` about an earlier synthetic Neon run remain prior-run evidence, not a result independently reproduced here. `docs/team/tickets/SW-0041.md` was absent at the frozen commit; this review follows the explicit Dispatch scope and SW-0038 ticket.

## Graft

🌱 Graft: **ACTIVE** — version 0.21.1 in this exact worktree. `graft map` refreshed the graph, indexed 34 files including API source and tests, and reported approximately 34,529 tokens saved. One `graft ask --source --in ourhoomu-api/` and four `graft skeleton` calls located the production and test entries; five of six retrieval calls reported savings totaling approximately **41,205 tokens**. `graft check` exited 0 and reported the wiring graph in sync; the deep meaning layer was not built. Markdown, JSONC and SQL were read directly because those details were not indexed. No savings are inferred for calls without a savings line.
