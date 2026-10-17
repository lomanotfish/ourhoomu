# SW-0065-front-security — independent frozen frontend security/correctness review

- Worker: security_engineer (Pi), terminal `term_89023ec2-ffe4-4f55-b188-6e573fc7eed8`
- Worktree: `/Users/afe/orca/workspaces/ourhoomu/r1-front-security`, branch `witchagorn/r1-front-security`
- Frozen delta reviewed: `ff99035..5ead364` (code `37b737a`, report commit `5ead364`), base `ff99035`
- Date: 2026-10-17
- Verdict: **approve** (with P2 follow-ups below; reviewer success is not implementation acceptance and does not close SW-0009/AC1a/AC2 or the actual-HTTP acceptance)

## Scope and method

Read-only review of the full frozen delta `ff99035..5ead364` (15 files: `app/api.tsx` ref correction, test-harness entry/runtime/routes/signin, `api-authenticated.spec.ts`, `api-local-http.spec.ts`, `api-mode.spec.ts` reformat, both Playwright configs, front report). Backend source `de37f13` was explicitly not a review target. Graft preflight: **ACTIVE** (`graft build`, 757 nodes / 125 cards, exact worktree). No product, test, DB, ticket, board or checklist files were modified; the only file written is this report.

Independent verification rerun in this worktree (frozen install `bun install --frozen-lockfile`, 700 packages; Bun 1.4.3):

| Command | Result |
| --- | --- |
| `bun test ./src` | **117 pass / 0 fail** (671 expect calls, 11 files) |
| `./node_modules/.bin/playwright test -c playwright.api.config.ts` | **11 passed** (2 signed-out + 9 authenticated) — independently reproduced |
| `bun run typecheck` / `bun run typecheck:e2e` | both clean |
| `bun run format:check` + `prettier --check 'test-harness/**' 'playwright.api*.config.ts'` | clean |
| `git diff --check ff99035..5ead364` | clean |
| Dev-server teardown after the fixture lane | port 18057 free (`lsof` empty) — owned server closed |

Note: `bunx playwright` pulled an unpinned `playwright@latest` into a temp dir and failed with MODULE_NOT_FOUND; the pinned local binary `./node_modules/.bin/playwright` was used instead. Future check docs should pin this invocation.

## Verified security/correctness properties

1. **`app/api.tsx` load/persistedHouseId-ref correction is sound against auth/house generations.** `load` now reads `persistedHouseId` through `persistedHouseIdRef` and depends only on `[runtime, authGeneration]` (`app/api.tsx:44-47,116,133`). A stale ref cannot bypass authorization: `selectHouse` only enters a house present in the freshly loaded authorized list (`src/repositories/house-selection.ts`), an absent persisted id yields `recovery_required` (error, no entry), and house-detail 403/404/410 still clears house data via `clearHouseData`. 401 paths clear the session through `clearAuthenticatedData` and the operation guard (`src/runtime/operation-guard.ts`) rejects responses whose load/auth/house generation moved. The pre-fix defect (reload loop duplicating initial load and wiping the 403/404/410 error) is genuinely removed.
2. **Test-only entry isolation holds.** Production `app/` and `entry-classic` are untouched; the harness serves `test-harness/routes/` through its own entry. `testRuntime` injection is guarded by `__DEV__ && EXPO_PUBLIC_API_TEST_HARNESS === 'true'` (`src/runtime/api-mode.tsx:48`), so a production build throws instead of accepting the injected memory runtime. Harness credentials live in a memory-only store (`test-harness/harness-runtime.ts`); nothing reaches SecureStore/storage.
3. **No public credential bridges or production bootstrap bypass.** Fixture tokens are clearly synthetic strings; the actual-HTTP lane signs in only through the loopback-guarded backend synthetic issuer (`/v1/auth/challenges` → `/__synthetic/token` → `/v1/auth/exchange`, `test-harness/routes/signin.tsx`), which is a test-only backend endpoint, not a production IdP path. The harness requires an explicit `EXPO_PUBLIC_API_BASE_URL` and fails closed without it. `EXPO_PUBLIC_API_HARNESS_SEED` defaults to seeded; the local lane sets `none`, and a forgotten unset would only present a fixture token to the real API → honest 401.
4. **No token leakage surfaces in the delta.** Grep of all delta files found no `console.*`, `localStorage`, `sessionStorage`, `window.*` or cookie writes; session/refresh tokens never appear in URLs (the `?subject=` query carries only a synthetic per-test UUID, not a credential), and error rendering shows status + server message only. Failure traces/screenshots are `retain-on-failure`/`only-on-failure` under git-ignored `test-results/`.
5. **Fixture lane assertions are meaningful, not mocked theater.** The fixture enforces bearer presence (including rotated tokens after refresh), `Idempotency-Key` on mutations, envelope shape, and no unexpected endpoints; every test asserts `violations` is empty. The screen under test is the real `app/api.tsx` re-exported by `routes/harness.tsx`/`routes/index.tsx`. `api-mode.spec.ts` changes are prettier-only (verified by diff).
6. **Stale-response rejection.** Browser-level delayed tests cover the drivable guards (late 401 detail → signed-out, slow logout, slow initial load). Overlapping house-selection races are not drivable through the real UI (controls disabled while `busy`), and the compensating unit evidence exists: `src/runtime/operation-guard.test.ts` proves rapid B→C selection commits only C, logout-while-pending blocks commits, and auth-generation changes reject deferred fulfillment. Browser claims should stay limited to what is actually driven — the front report already states this honestly.
7. **Per-test isolation and lifecycle.** Fixture lane: fresh state + fresh routes per test, 2 workers, dedicated ports 18057/18058, `reuseExistingServer: false`, graceful SIGTERM shutdown (verified free port). Local lane: workers 1, per-test random synthetic subject, dedicated ports 18067/18775.

## Findings

### P2-1 — `playwright-report-local/` (actual-HTTP lane HTML report) is not git-ignored
- Path: `ourhoomu-front/playwright.api-local.config.ts:19` (`outputFolder: 'playwright-report-local'`) vs `ourhoomu-front/.gitignore:2` (`/playwright-report/` only).
- Reproduction: `git check-ignore -v ourhoomu-front/playwright-report-local/x` → no match (while `test-results/x` and `playwright-report/x` are ignored).
- Impact: once the actual-HTTP lane runs, failure traces/screenshots (which capture full network traffic, including synthetic session/refresh tokens and idTokens) would land in an untracked folder that invites accidental commit, violating the SW-0047 rule that failure evidence stays "local ignored artifacts". No artifacts exist yet (lane not run), so no leak has occurred.
- Fix (owner: frontend/QA via Lead): add `/playwright-report-local/` to `ourhoomu-front/.gitignore`.

### P2-2 — Browser-level privilege-boundary coverage gap for invitations/accounts
- Path: `ourhoomu-front/test-harness/api-authenticated.spec.ts` (fixture models 403 only on house detail, `detailStatus`; no fixture path forces 403 on `POST/DELETE /v1/houses/:id/invitations`), and `test-harness/api-local-http.spec.ts` (owner happy paths only).
- Impact: SW-0065 acceptance includes "permissions/cross-house boundaries hold", but no browser test evidences the honest 403 UX when a non-owner (or a member whose house access was revoked) attempts invitation issue/revoke, even though the screen implements that path (`clearHouseData` on 403/404/410 in `createInvitation`/`revokeInvitation`, `app/api.tsx:355-369,394-408`). Server-side enforcement is backend scope; this is a frontend evidence gap, not a demonstrated vulnerability.
- Fix: add a fixture test forcing 403 on invitation issue/revoke and assert the house is cleared with the error shown; mirror in the actual-HTTP lane once the DB window allows a second identity.

### P2-3 — Bootstrap HTML rewrite is fail-closed but not fail-loud (local lane)
- Path: `ourhoomu-front/test-harness/api-local-http.spec.ts:17-31` (`serveHarnessEntry`).
- `template.replace('transform.routerRoot=app', …)` is a silent no-op if Expo changes the dev template marker; the lane would then exercise the production `app/` routes and fail with confusing assertion errors instead of an explicit rewrite failure. The fixture lane's `serveHarnessDocument` does this correctly (throws when the bundle URL regex misses, `api-authenticated.spec.ts:318-322`). Minor: the document is fetched twice (`route.fetch()` for text and again for `response`).
- Fix: throw when `transform.routerRoot=app` is absent, and reuse a single `route.fetch()` result.

### Observations (no action required this round)
- `persistedHouseIdRef` is written during render (`app/api.tsx:47`), consistent with the pre-existing `authGenerationRef`/`activeHouseIdRef` pattern; safe under current usage, worth revisiting if concurrent features are adopted.
- The fixture keeps the pre-rotation access token valid after refresh rotation (fidelity note only; fixture-only surface).
- `test-harness/routes/probe.tsx` is a debug-only route (manual smoke checks per the front report); harmless test-only dead code.
- The `?subject=` synthetic identity appears in the page URL (dev-server logs/history); non-credential, loopback-only lane — acceptable.

## Explicit limits

- **Actual-local-HTTP browser/API lane NOT VERIFIED** (matches the front report): no backend on 18775, no DB window for this worker; I did not start servers beyond the offline fixture lane's own webServer, and no DB was touched.
- Backend source `de37f13` and the default/origin correction owner were not reviewed (out of scope).
- Native/Google/Apple, TestFlight, production, provider and release acceptance remain open and are not affected by this review.
- The broad `pkill` incident is historical (recorded in the front report); I ran no process operations beyond my own Playwright webServer lifecycle.

## Verdict rationale

The frozen delta contains no security defect: authorization flows on the real screen are generation-guarded, the test-only harness is properly isolated behind `__DEV__` + explicit env flags, credentials stay in memory, and no mock is presented as real-API evidence. The three P2s are evidence/config hygiene items for the Lead to schedule; none blocks the fixture-lane results I independently reproduced. Implementation acceptance remains the Lead's call, and the actual-HTTP lane must still be run in its authorized window before any actual-handler acceptance is claimed.
