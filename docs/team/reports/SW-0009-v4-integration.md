# SW-0009 frontend API integration report

Status: bounded frontend API-mode implementation retained; this correction fixes three session test fixtures and removes a leftover no-op condition. Full SW-0009 acceptance remains open. Task scope: `ourhoomu-bootstrap-fixtures-precise`. No commit created.

## Implemented scope

- Preserved the existing demo provider, welcome flow, sample screens, calendar, theme, motion and API shell. The dirty `app/api.tsx` generation guards remain unchanged and were not extended in this task.
- Corrected the unauthorized bootstrap test so both `createApiSession` and its owning `createSessionAuthority` have injected fetchers; the authority callback records authenticated-cache clearing. This prevents accidental external networking.
- Corrected the concurrent bootstrap test to exercise three direct `api.bootstrap()` calls, return 401 for old credentials and profile data for the rotated bearer, wait for the shared refresh replay, and resolve the retry gate afterward. It asserts six `/me` fetches, two refresh fetches, identical idempotency key and request body.
- Corrected expiry coverage to obtain the canonical server-directed refresh via `/me` 401 from `api.bootstrap()`, followed by a successful profile using the rotated access token. No proactive-refresh expectation was introduced.
- Removed the `&& true` no-op from the existing 401 cleanup predicate; 401 handling remains status- and session-revision-guarded.

## Verification

All commands ran in `ourhoomu-front` under Bun 1.4.3; commands with test execution use bounded Bun timeouts.

- `bun test --timeout 5000 src/session/api-session.test.ts`: **passed**, 9 tests / 38 assertions.
- `bun test --timeout 10000 src/session/api-session.test.ts src/session/authority.test.ts src/session/native-secure-credentials.test.ts`: **passed**, 34 tests / 122 assertions.
- `bun test --timeout 10000 src`: **passed**, 110 tests / 657 assertions.
- `bun run typecheck`: **passed** (Turbo frontend typecheck and E2E typecheck plus workspace contracts/API typechecks).
- `bun run format:check`: **passed** (workspace format checks).
- `bun run export:web`: **passed**; Expo emitted non-fatal `NO_COLOR`/`FORCE_COLOR` environment warnings.
- `bun run export:ios`: **passed**; JavaScript/Hermes bundle only, not native build or device evidence.
- `git diff --check`: **passed**.
- An initial focused test attempt exposed three fixture issues (cache-clear callback ownership, concurrent `/me` calls not receiving old-token 401s, and missing initial `/me` in the expiry path); fixtures were corrected and the final runs above passed. A first workspace `bun run format` invocation was unavailable at the root; formatting was run using `bun run --filter ourhoomu-front format` before the successful check.

## Remaining acceptance / risks

- Tests use injected synthetic session fixtures; they do not verify live API handlers, database behavior, native Google/Apple identity, Keychain/device behavior or production.
- Exports do not constitute iOS native startup/device, accessibility, provider or TestFlight acceptance.
- Full SW-0009 and backend-dependent house/session acceptance remain open. No Playwright rerun was necessary for these fixture-only changes; previously recorded demo/workerd Playwright evidence in this report's history does not establish authenticated product API acceptance.

## Changed files

- `ourhoomu-front/src/session/api-session.test.ts`
- `ourhoomu-front/src/session/api-session.ts`
- `docs/team/reports/SW-0009-v4-integration.md`
