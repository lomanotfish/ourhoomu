# SW-0005 v4 core HTTP integration attempt

## Source and scope

- Candidate source SHA before this correction: `f1498622e48e09aab78f8f520c151ba560c63bb3` (`codex/v4-core-api`). Corrected source SHA: fill from the committed change; current verification used the working tree with the two backend fixes below.
- The task scope permits backend API handlers/tests/scripts/README and this report; no `src/db/**`, DB scripts, contract, manifest, lockfile, frontend or schema changes were made.
- Current checkout contains SW-0059's reviewed data seam and the existing HTTP adapter/tests. I inspected their interfaces and callers read-only. No DB credentials were read and no database request was made.
- Graft was built and checked in this exact checkout; `graft check .` reported graph in sync (97 indexed files, 573 nodes, 1,354 edges). `graft map` and focused `graft callers`/`graft grep` calls were used before direct source review.

## Findings / blocker

The data adapter contract is only structural at present: `HttpTransaction` in `ourhoomu-api/src/modules/core/data.ts` duplicates signatures from `CoreTransaction`, and `runtime.ts` checks only some required methods by name at runtime. It does not presently add a missing `SessionStore` method or complete a DB-backed real-handler run.

Strict typecheck exposed exchange-result union narrowing and overloaded fixture implementation errors in backend-owned files. Corrected `src/modules/auth/session.ts` by separating the replay and verified-exchange results, narrowing the returned replay ciphertext, and failing closed on malformed union values. Corrected `tests/fixtures/core-session.ts` by adapting its synthetic executor to the authoritative overloaded `SessionStore['execute']` signature while keeping fixture input handling local. `src/db/types.ts`, the DB interface, DB schemas and public API contract were not changed.

## Verification completed

- `cd ourhoomu-api && bun run typecheck`: exit 0.
- `cd ourhoomu-api && bun test tests`: exit 0; API 91 tests / 266 assertions.
- `cd ourhoomu-api && bun run format:check`: exit 0.
- `cd ourhoomu-api && bun run lint`: exit 0.
- `cd ourhoomu-api && bun run build:worker`: exit 0; Wrangler dry-run only.
- `git diff --check`: exit 0.
- `bun run check:fixture-runtime`: attempted but failed at the fixture runtime check health-envelope assertion (`health.response.status` was 200 while the script rejected the response); this is not a real-handler DB acceptance check and was not treated as passing.
- `git diff --check`: exit 0.
- No DB calls, DB fixtures, synthetic server, Playwright API acceptance or native/provider requests were run. The guarded synthetic artifacts appear available locally, but the task explicitly says the exclusive DB window has not been granted; do not infer authorization from file existence. Exact DB readiness is therefore *prepared but not authorized*: require Lead to grant a fresh exclusive synthetic-window interval and confirm ownership handoff before any `CORE_HTTP_BINDINGS_FILE` preparation against credentials or any command that touches the DB.

## Acceptance state / next action

Not accepted as completed SW-0005. Existing code/test evidence covers some in-process synthetic issuer/session and stubbed data-handler paths, but does not meet the requested real handler + restricted DB acceptance. Next: Tech Lead must grant an exclusive synthetic DB acceptance window and confirm handoff from the security reviewer. Then follow `ourhoomu-api/README.md`'s Neon proof setup using private `SYNTHETIC_DB_ENV_FILE` and `NEON_BRANCH_RECEIPT`: run `cd ourhoomu-api && bun run prepare:neon-runtime`, start `bunx wrangler dev --config wrangler.runtime.jsonc --ip 127.0.0.1 --port 8787`, then in a second terminal run `bun run check:fixture-runtime && bun run check:neon-runtime`. That is only the isolated runtime/RLS proof. For the task's real-handler acceptance, follow `ourhoomu-api/README.md`'s HTTP acceptance section: after the Lead grants exclusive synthetic DB access and accepts the SW-0059 data/auth replay seam, point `SYNTHETIC_DB_ENV_FILE` and `NEON_BRANCH_RECEIPT` to existing guarded files, configure an ignored mode-600 `CORE_HTTP_BINDINGS_FILE` with the specified restricted roles and synthetic Google issuer, then run `ALLOW_CORE_HTTP_ACCEPTANCE=true CORE_HTTP_TEST_SHA="$(git rev-parse HEAD)" bun run test:http` from `ourhoomu-api/`. This is the exact core API acceptance command; the separate runtime RLS proof is not a substitute. No DB access was attempted in this task. This correction does not claim SW-0005 acceptance: actual Elysia handlers + restricted synthetic DB, full auth/house/member/invite/account permissions, replay and malformed-input acceptance still need evidence. Native Google/Apple, live issuer/provider, production and release acceptance remain explicitly out of scope and unclaimed.
