# SW-0065-front — Round 1 authenticated house/session acceptance (frontend)

- Worker: Pi frontend engineer, terminal `term_c00c8d24-b183-4487-adec-16703bbed1d5`
- Worktree: `/Users/afe/orca/workspaces/ourhoomu/r1-house-session-front`, branch `witchagorn/r1-house-session-front`
- Baseline: `ff99035`; code commit: **`37b737a1984b704a155023eb6ec04da3920c4471`** (`37b737a`)
- Date: 2026-10-17

## Scope delivered

1. **Fixture lane (offline, page.route)** — extended `ourhoomu-front/playwright.api.config.ts`
   (ports 18057 UI / 18058 fixture origin) with two projects:
   - `api-signedout`: existing `test-harness/api-mode.spec.ts` (unchanged behavior; prettier-only reformat).
   - `api-harness-authenticated`: new `test-harness/api-authenticated.spec.ts` (11 tests total in the suite).
2. **Test-only Expo Router entry** — `test-harness/entry.tsx` mirrors the production
   `entry-classic` bootstrap (`@expo/metro-runtime` first import, `registerRootComponent`)
   and serves `test-harness/routes/` via `require.context(..., 'sync')`. Production
   `app/` and `entry-classic` are untouched.
3. **Harness runtime** — `test-harness/harness-runtime.ts` builds the real production
   composition (`createApiClient`, `createApiSession`, `createSessionAuthority`,
   `createHouseRepository`) with a memory-only credential store. Fixture mode seeds a
   synthetic fixture session; `EXPO_PUBLIC_API_HARNESS_SEED=none` starts empty for the
   actual-HTTP lane. Credentials never touch storage.
4. **Harness routes** — `routes/_layout.tsx` (SafeAreaProvider + `AppRuntimeProvider
   testRuntime` + `Slot`), `routes/harness.tsx` and `routes/index.tsx` re-export the real
   `app/api.tsx` screen, `routes/probe.tsx` (debug), `routes/signin.tsx` (actual-HTTP lane).
5. **Actual-local-HTTP browser lane (built, NOT VERIFIED)** —
   `playwright.api-local.config.ts` (UI `http://localhost:18067`, API `http://127.0.0.1:18775`,
   workers 1) + `test-harness/api-local-http.spec.ts`. **No API request is mocked**; the
   only interception is a bootstrap-only document rewrite that changes
   `transform.routerRoot=app` → `transform.routerRoot=test-harness/routes` in the dev
   server's HTML template so the real dev server serves the harness route tree.
   Sign-in uses the agreed synthetic-issuer proof pattern (POST `/v1/auth/challenges` →
   POST `/__synthetic/token` → POST `/v1/auth/exchange`, Idempotency-Key on mutations,
   per-test random subject via `?subject=`), matching `ourhoomu-api/http-acceptance/core.spec.ts`.
6. **Narrow reproduced-defect fix in `app/api.tsx`** — `load` depended on
   `persistedHouseId`, so every set/clear of the persisted house re-ran the full
   bootstrap effect: the initial load executed twice, and a 403/404/410 house-detail
   error was immediately wiped because clearing the persisted house re-triggered a
   reload that re-entered the house. Fixed by reading `persistedHouseId` through a ref
   (`persistedHouseIdRef`) and dropping it from `load`'s dependencies. Behavior is
   otherwise unchanged; verified by the full local check suite.

## Commands and results (all run in `ourhoomu-front/`, Bun 1.4.3)

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` (repo root) | OK (700 packages) |
| `bunx playwright test -c playwright.api.config.ts` | **11 passed** (2 signed-out + 9 authenticated, incl. 3 delayed-response tests) |
| `bun run typecheck` (`tsc --noEmit`) | clean |
| `bun run typecheck:e2e` (`tsc -p tsconfig.e2e.json`) | clean |
| `bun run format:check` + `prettier --check 'test-harness/**' 'playwright.api*.config.ts'` | clean |
| `bun test ./src` | 117 pass / 0 fail |

Authenticated harness coverage: zero/one/many houses, create + auto-enter, member
detail on selection, invitation issue + revoke, recipient-account list + create,
logout (bearer + honest no-session bootstrap), 401 me → sign-out (refresh failure
modeled), 500 houses error, 403 detail clears house, delayed initial load, late 401
detail → signed-out, slow logout. The fixture API also enforces bearer presence,
Idempotency-Key on mutations, envelope shape, and no unexpected endpoints
(`violations` asserted empty in every test), and models refresh rotation
(`/v1/auth/refresh` accepts the fixture refresh token; forced-failure mode for the
401 test).

## Not verified / limitations

- **Actual-local-HTTP lane NOT VERIFIED**: the backend synthetic issuer + real
  handlers on 18775 were not up during this round and the Lead has not yet opened
  the DB window ("No DB run until my followup"). The lane is built and its
  bootstrap was smoke-checked (harness bundle builds on 18067; `/signin` renders
  through the real dev server with the router-root rewrite). It must be run after
  the backend window opens.
- Stale-generation races between two overlapping house selections cannot be driven
  through the real UI because the screen disables all controls while `busy`; the
  delayed-response tests instead cover the drivable guards (late 401 detail, slow
  logout, slow initial load).
- Post-logout the harness lands on the index route with no stored credentials, so
  the honest visible state is the bootstrap error card ("No authenticated session"),
  not the signed-out card; tests assert the actual behavior.
- `pkill -f expo` was used several times during early debugging before the Lead's
  instruction; affected PIDs were not recorded. Later cleanup used exact-PID
  matching (`lsof` on port 18067, cwd-verified kill of PID 45418 only).
- Untracked `../.ignore` at the worktree root is Graft tooling output (created by
  `graft build`); left uncommitted, not task scope.
- Graft: ACTIVE in this worktree (`graft build`, 114 files) — used for architecture
  discovery before reading raw sources.

## Debugging notes (for future rounds)

- Metro served a stale cached harness bundle across dev-server restarts; a
  `--clear` restart revealed the real failures (missing `AppRuntimeProvider` in the
  harness layout, and a draft `Head` named-import crash from `expo-router/head`).
- `expo-router`'s `Slot` takes no props (renders the matched route from context);
  passing children type-errors (TS2559).
