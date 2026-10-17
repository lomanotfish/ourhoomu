# SW-0065-api report — Round 1 authenticated house/session backend acceptance

## Correction round (re-dispatch ctx_9c9f815e2a47, 2026-10-17)

- Worker: backend (Pi, interactive `pi --provider clicknext --model auto`), terminal
  `term_249d4790-9747-4570-938d-87cfccd54d54`, task `task_abee9d04b47a`, dispatch
  `ctx_9c9f815e2a47` (recovery after the prior exact agent positively exited with a
  failed dispatch; source de37f13/report and its dirty correction were preserved).
- Graft preflight: `graft ask "where is the core HTTP acceptance server fixture and
  synthetic issuer, and how are target guards and loadTarget used for DB HTTP
  acceptance" --source` in the exact workspace → graph refreshed (2 files changed),
  **Graft: ACTIVE** (graft 0.21.1; ~15,345 tokens saved on the preflight call).
- Inherited dirty state: the prior backend owner's uncommitted correction (per Lead
  msg_2ca1b1cea798 / msg_7a40b088ae27) changed the baseline defaults to port `18765`
  and origin `http://localhost:8081` selected via a validated `CORE_HTTP_ORIGIN`, but
  referenced `frontendOrigin` before its declaration (TDZ ReferenceError — the fixture
  server could not start). This dispatch finished that correction only; no new
  scaffold, no handler changes, no frontend/contract/schema edits.
- Fix committed `5050b3a` (tested tree `e766ce78f52276bed2d5e27e7a245e6844710535`):
  validated loopback origin + port parsed **before** `createRuntimeApp`; accepted
  baseline defaults retained (port `18765`, origin `http://localhost:8081`); round 1
  passes explicit `CORE_HTTP_PORT=18775` + `CORE_HTTP_ORIGIN=http://localhost:18067`
  (strict loopback regex, otherwise fail closed). The origin-contract test now asserts
  the selected origin (`process.env.CORE_HTTP_ORIGIN ?? 'http://localhost:8081'`)
  instead of hardcoding 18067; foreign-origin 403 assertion unchanged.
- Fresh frozen install: `bun install --frozen-lockfile` (Bun 1.4.3 pinned, 708
  installs checked, no changes). Offline checks at tree `e766ce78…`: `bun run
  typecheck` pass, `bun run format:check` pass (57 files; one biome format fix
  applied to the two edited files first), `bun run lint` pass no warnings, `bun test
  tests` **93 pass / 0 fail, 290 assertions, 11 files**.
- Guarded DB window (granted again to this dispatch only): same files as below,
  re-verified mode 600 and receipt freshness (`br-weathered-thunder-b38dgxbm`,
  endpoint allowlist unchanged, expires 2026-10-20T12:00:00Z > run time); no reset,
  migration, grant or privilege change; no provider calls; no secret content printed.
- Listener preflight `lsof -nP -iTCP:18765 -iTCP:18775 -iTCP:18067 -sTCP:LISTEN` →
  no listeners before either run; identical check after both runs → no owned listener
  remains (Playwright webServer teardown confirmed).
- Actual HTTP acceptance against the real Elysia runtime app + restricted synthetic
  Neon roles + signed synthetic issuer, both configurations, 11 tests each:

| Run | Env | Result |
| --- | --- | --- |
| Default compatibility | no `CORE_HTTP_PORT`/`CORE_HTTP_ORIGIN` → port 18765, origin http://localhost:8081 | **11 passed (24.2s)** |
| Round 1 explicit | `CORE_HTTP_PORT=18775 CORE_HTTP_ORIGIN=http://localhost:18067` | **11 passed (24.0s)** |

  Both runs: `ALLOW_CORE_HTTP_ACCEPTANCE=true CORE_HTTP_BINDINGS_FILE=…
  SYNTHETIC_DB_ENV_FILE=… NEON_BRANCH_RECEIPT=… CORE_HTTP_TEST_SHA=e766ce78…(40-hex)
  bunx playwright test --config playwright.config.ts`. Role/target guards (mode-600
  files, binding-vs-target equality, synthetic issuer config, 40-hex SHA) passed at
  startup in both runs; new synthetic rows only, in the existing isolated test target.
- **DB window released to the Lead** as of this correction round; no further
  synthetic DB access from this worker. Own servers/pools closed (process exited via
  Playwright teardown; lsof clean).
- Commits this round: `5050b3a` (code) + report commit (this file). Baseline remains
  `ff99035`; prior round-1 commit `de37f13` unchanged.

---

## Round 1 (prior dispatch ctx_ab157f3abada, historical)

- Worker: backend (Pi, interactive `pi --provider clicknext --model auto`), terminal
  `term_7ecb4858-038b-4bd3-8c53-0ac86873c822`, task `task_abee9d04b47a`, dispatch
  `ctx_ab157f3abada`.
- Worktree: `/Users/afe/orca/workspaces/ourhoomu/r1-house-session-api`, branch
  `witchagorn/r1-house-session-api`, baseline `ff99035`. Clean tree at start; only
  scoped files changed (see below). No frontend, shared contract, schema/SQL,
  migration, grant, root manifest or lockfile edits.
- Graft preflight: `graft ask "house session HTTP acceptance fixtures core-http-server" .`
  in the exact workspace → `[graft] refreshed the graph (878 files changed) … copied
  the graph from the main checkout` → **Graft: ACTIVE** (graft 0.21.1). Raw reads used
  for docs and the ticket file per fallback rules.

## Scope delivered

1. **Dedicated loopback ports/origin for the browser round** (fixture-only, test-gated):
   - `ourhoomu-api/tests/fixtures/core-http-server.ts`: `allowedOrigin` is now exactly
     `http://localhost:18067` (UI port 18067) and the default acceptance port is
     `18775` (dedicated API port). `ourhoomu-api/playwright.config.ts` default port
     aligned to `18775`.
   - `/__synthetic/token` and `/__synthetic/issuer-clock` now answer CORS preflight
     (204) and carry `access-control-allow-origin: http://localhost:18067` so a real
     browser test entry can mint the synthetic proof from the UI origin; requests with
     a foreign `Origin` header are refused with 403. These endpoints remain test-only:
     the Worker entrypoint (`src/index.ts`, `tests/fixtures/worker.ts`, wrangler
     configs) does not import the fixture server (verified by grep), and the server
     refuses to start without `ALLOW_CORE_HTTP_ACCEPTANCE=true`, a mode-600
     `CORE_HTTP_BINDINGS_FILE` and the guarded synthetic target.
   - No production login bypass added; the synthetic issuer `https://synthetic.invalid`
     config guard is unchanged and browser entry uses the real
     challenge → proof → exchange flow into a memory-only credential store.
2. **Extended real-handler HTTP acceptance** (`ourhoomu-api/http-acceptance/core.spec.ts`,
   7 → 11 tests), all against the actual Elysia runtime app, restricted synthetic
   Neon roles and the signed synthetic issuer:
   - exact loopback frontend origin contract (app CORS + synthetic endpoint CORS +
     foreign-origin rejection);
   - multi-house membership, cross-house isolation (outsider 404 on house/members/
     invitations) and delayed responses after member removal preserve correct state;
   - member logout after membership: delayed refresh/me fail with 401 while the owner
     session and active membership projection stay intact;
   - expired single-use invitation refused with 409 `invite_unavailable` after its
     declared lifetime (pinned to the SQL behavior in `drizzle/0001_core_operations.sql`).
3. **Scoped artifact ignore**: `ourhoomu-api/.gitignore` adds `test-results/` and
   `playwright-report/` (Playwright run artifacts only).

## Guarded DB window evidence (no secrets printed)

- Secret file: `/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env`
  (mode 600, mtime 2026-10-15 08:39).
- Binding file: `/Users/afe/Desktop/ourhoomu/.git/core-finish/sw-0005-http.env`
  (mode 600, mtime 2026-10-16 12:49) — existing file, not overwritten; fresh key
  material used by other tests untouched.
- Receipt: `/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json`
  → branch `br-weathered-thunder-b38dgxbm`, name `dev-core-sw0036-20261013`,
  init `parent-schema`, endpoint `ep-dry-breeze-b3e8t69s`, expires
  `2026-10-20T12:00:00Z` (fresh at run time). Exact allowlist match via existing
  `loadTarget()`/`validateCoreTarget()` guards; no reset, migration, grant or
  privilege change; no provider calls.
- Listener preflight: `lsof -nP -iTCP:18775 -iTCP:18067 -iTCP:18765 -sTCP:LISTEN`
  → no listeners before start. Post-run: no listener remains on 18775 (Playwright
  webServer teardown confirmed).

## Actual commands and results (tested SHA)

Tested SHA: `ff99035` tree + the scoped changes below (commit recorded after this
report; see commit message for the exact SHA).

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` (root, Bun 1.4.3 pinned) | 700 packages installed, frozen lockfile honored |
| `bun run typecheck` (ourhoomu-api) | pass (`tsc --noEmit`) |
| `bun run format:check` | pass (57 files) |
| `bun run lint` | pass, no warnings |
| `bun test tests` | **93 pass / 0 fail**, 290 assertions, 11 files |
| `ALLOW_CORE_HTTP_ACCEPTANCE=true CORE_HTTP_BINDINGS_FILE=… NEON_BRANCH_RECEIPT=… SYNTHETIC_DB_ENV_FILE=… CORE_HTTP_TEST_SHA=<40-hex> CORE_HTTP_PORT=18775 bunx playwright test --config playwright.config.ts` | **11 passed (23.4s)** — 7 existing + 4 new; run repeated 3× during development, all green |

Role/target guard results observed at runtime: binding connections matched the
guarded synthetic target, synthetic issuer config guard passed, `CORE_HTTP_TEST_SHA`
40-hex assertion passed, mode-600 file checks passed. Failures encountered during
development were formatting only (biome), fixed and re-verified; no handler defect
was demonstrated, so no production handler code was changed.

## Frontend contract published (via Lead, msg_fbdf2beb831f)

- Fixture API: `bun tests/fixtures/core-http-server.ts` on `127.0.0.1:18775`,
  CORS origin exactly `http://localhost:18067`.
- Browser login: `POST /v1/auth/challenges` → `POST /__synthetic/token`
  `{nonce, subject, email?}` → `POST /v1/auth/exchange` → memory-only credentials.
- Mutations need `idempotency-key`; responses `{data,requestId}` /
  `{error:{code,message},requestId}`.
- The DB window was exclusive to this worker; a joint frontend browser run against
  the real DB needs a window the Lead schedules after this release.

## Teardown and window release

- Owned fixture server torn down by Playwright; `lsof` confirms port 18775 free.
- No owned pools kept open (fixture server owns its per-request pools; process exited).
- **DB window released to the Lead** as of this report; no further synthetic DB
  access from this worker.

## Limits / next acceptance steps

- Browser-driven end-to-end flow (actual screens) is the frontend owner's
  SW-0065-front deliverable consuming this contract; my evidence covers real
  handlers + restricted DB at HTTP level, not browser UI.
- Original SW-0005 full native/provider acceptance and account deletion remain
  open and gated as before.
- Independent QA/security review runs against the settled frozen source per the
  SW-0065 assignment.
