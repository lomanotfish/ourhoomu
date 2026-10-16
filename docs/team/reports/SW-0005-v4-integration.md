# SW-0005 v4 core HTTP integration report

## Source and scope

- Base source SHA: `fd099e7623b587e9e6ed2e20b0c6af5a12d9f87e` (`codex/v4-core-api`); the scoped implementation and checks are on this base. Commit SHA is available from the resulting commit.
- Scope: backend API adapter, tests, runtime check, API README and this report. No `src/db/**`, DB scripts, schema, contract or lockfile changes were made. `ourhoomu-api/package.json` changes only the runtime-check mode flag.
- No DB credentials were read and no database request was made; DB ownership remains with the data engineer.

## Pagination and runtime corrections

The reproduced pagination defect came from collecting/capping up to 100 records in the HTTP adapter and only applying the signed HTTP cursor afterward. The corrected flow decodes and verifies the actor/path-bound cursor before any data projection call, then requests `min(limit + 1, 100)` after that UUID. The extra row determines whether to sign a continuation cursor. At limit 100, the adapter performs one `limit: 1` probe after the last returned ID because the data adapter's maximum query limit is 100. Houses, members and accounts follow the same flow. Account read/list projections are required, not optional runtime fallbacks.

`HttpTransaction` now uses `Pick<CoreTransaction, ...>` for the HTTP projection signatures, so TypeScript checks structural compatibility against the actual transaction implementation. Runtime projection-name checks were removed. Focused tests exercise regular 20-row pagination, 101 houses across a 100-row page and continuation, query bounds, and malformed/tampered/cross-user/cross-route cursors.

The runtime check also now requires an explicit loopback `RUNTIME_BASE_URL`, requires exactly one production/fixture mode, checks exact expected HTTP status/error codes and non-empty request IDs, and the `check:runtime` package command explicitly selects production mode. README commands use dedicated ports. The previously occupied unrelated `8787` listener was not touched.

## Verification

- `cd ourhoomu-api && bun test tests/auth/core-data.test.ts tests/auth/core-http.test.ts`: 18 tests / 134 assertions passed.
- `cd ourhoomu-api && bun run lint`: passed.
- `cd ourhoomu-api && bun run format:check`: passed.
- `cd ourhoomu-api && bun run typecheck`: passed.
- `cd ourhoomu-api && bun test tests`: 93 tests / 290 assertions passed.
- `cd ourhoomu-api && bun run build:worker`: passed Wrangler dry-run; no deployment.
- `git diff --check`: passed.
- Real credential-free workerd runtime checks were not rerun in this correction. Prior runtime-check results documented in earlier work are not claimed as this source revision evidence.
- No DB calls, DB fixtures, Playwright API acceptance, provider/native requests, deployment or production operations were run.

## Acceptance state and next action

The offline code correction is ready for review/commit, but SW-0005 acceptance remains pending because real handlers against the restricted synthetic DB were not exercised. DB readiness is prepared but not authorized: the Lead/data owner must grant a fresh exclusive synthetic-window interval and confirm ownership before any credential/environment preparation that may touch DB or any DB command. Once authorized, run the README's isolated runtime/RLS proof and HTTP acceptance separately; runtime proof does not substitute for full handler acceptance. The remaining acceptance needs real handler tests for auth, house/member/invite/account permission, replay and malformed-input paths. Native Google/Apple, live provider, production and release acceptance remain explicitly out of scope.
