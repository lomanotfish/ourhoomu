# SW-0009 frontend API integration report

Status: bounded frontend API-mode implementation retained; focused session corrections pass. Full SW-0009 acceptance remains open. Target branch `codex/v4-front-core`, baseline `3e7c598` (working directory task worktree). No commit created.

## Implemented

- Preserved the existing demo provider, welcome flow and sample screens as the default explicit `EXPO_PUBLIC_APP_MODE=demo` mode.
- Added opt-in `EXPO_PUBLIC_APP_MODE=api` runtime and API shell with no demo fallback. Existing accepted `ApiClient`, `SessionAuthority`, native SecureStore adapter and house repository are composed together.
- Session bootstrap and transport use the canonical authority for token state and refresh. Logout invalidates locally before remote revoke, and local/cache clearing occurs even if the server rejects the revoke.
- API shell fetches authorized houses with cursor pagination, handles zero/one/many selection, and supports its assigned API flows with loading/empty/error/retry states. API mode does not fabricate a logged-in user or fall back to demo.
- Native runtime uses the existing SecureStore. Web runtime uses only volatile in-memory storage (no localStorage/cookie persistence). Local HTTP requires explicit local-acceptance env and `__DEV__`; normal API URLs require HTTPS.
- Google/Apple login remains unavailable; no provider setup or fake credential injection was added.

## Tests and verification

- `cd ourhoomu-front && bun test ./src/session/api-session.test.ts`: passed, 9 tests / 34 assertions. Regression specifically verifies the first shared refresh is retained without awaiting, concurrent callers join it while retry fetch is pending, then first response resolves; both exact idempotency keys and body stability are checked. No production timeout bypass or weakened test.
- `cd ourhoomu-front && bun test ./src/session`: passed, 76 tests / 334 assertions.
- `cd ourhoomu-front && bun test ./src`: passed, 110 tests / 653 assertions.
- `cd ourhoomu-front && bun run typecheck` (root Turbo frontend typecheck and E2E typecheck): passed.
- `cd ourhoomu-front && bun run format:check`: passed after formatting the focused test.
- `cd ourhoomu-front && bun run export:web`: passed.
- `cd ourhoomu-front && bun run export:ios`: passed (JavaScript/Hermes bundle only, not native startup/device evidence).
- `cd ourhoomu-front && bun run test:e2e`: passed, 24 tests (desktop/mobile Chromium demo flows and local workerd API entrypoint). Demo tests are in-memory synthetic demo flows; workerd checks do not prove authenticated product handlers/database acceptance.
- `bun expo install --check` was previously observed failing on pre-existing Expo compatibility drift (Expo SDK, constants, linking and router patch versions). No manifest/lock changes made under the task contract.
- An initial focused test run exposed an incorrect refresh-request expectation: authority correctly coalesces both callers into one retry (two total fetches, not three). Adjusted the assertion to the observed exact behavior, then focused and full unit suites passed. A first root-relative test command was also run from repository root (tests are in the frontend workspace); subsequent commands were run from `ourhoomu-front`.

## Remaining / risks

- No challenge/exchange/provider flow because Google/Apple native proof and issuer acceptance remain gated. No local injected signed-credential test mechanism implemented.
- API session logic has synthetic fixture/unit coverage, not authenticated live API-handler acceptance. Backend-dependent house/session flows and isolated synthetic DB acceptance remain unverified.
- No native device build, VoiceOver/Dynamic Type, real provider proof, or production acceptance. JavaScript export is not native startup evidence.
- Expo package compatibility drift remains; resolving it requires manifest/lock ownership not included here.

## Changed files

- `ourhoomu-front/src/session/api-session.ts`
- `ourhoomu-front/src/session/api-session.test.ts`
- `ourhoomu-front/src/runtime/api-mode.tsx`
- `ourhoomu-front/app/_layout.tsx`
- `ourhoomu-front/app/index.tsx`
- `ourhoomu-front/app/api.tsx`
- `ourhoomu-front/README.md`
- `docs/team/reports/SW-0009-v4-integration.md`
