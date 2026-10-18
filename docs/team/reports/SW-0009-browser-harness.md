# SW-0009 browser harness checkpoint

## Status

**Bounded harness implemented; authenticated browser acceptance remains blocked
by a precise test-entrypoint seam.** The existing API screen/runtime are reachable
in the browser in explicit API mode without injected credentials. HTTP route fixtures are registered but not exercised: signed-out bootstrap makes zero /me requests. The tests demonstrate signed-out retry and no demo fallback only. No claim
of authenticated houses, real API handlers, database, provider or native login
acceptance is made.

## Scope and source inspected

Task base/source: `aed0bd8c7aedde82431c3077de2a7e844056c9d2` (`codex/v4-front-core`).
The production app/router/provider source was not modified. Inspected
`ourhoomu-front/src/runtime/api-mode.tsx`, `app/_layout.tsx`, `app/api.tsx`,
`src/session/api-session.ts`, API transport and house repository.

`AppRuntimeProvider` accepts optional `testRuntime`, requiring both `__DEV__`
and `EXPO_PUBLIC_API_TEST_HARNESS=true`; it further requires the client, session
and house repository. Current Expo Router root layout does not accept or supply
that override. The current root does not provide the test override; the bundle development flag was not independently verified. Existing root tests use normal construction and unauthenticated bootstrap. Passing private credentials through a browser global, URL, or
production bridge would violate the task boundary and is not done.

## Implemented

- `ourhoomu-front/playwright.api.config.ts`: dedicated harness config and port
  `18057`; refuses reuse of an existing server. Fixture requests use
  `127.0.0.1:18058`; no local API/Workers process is started.
- `ourhoomu-front/test-harness/api-mode.spec.ts`: two Playwright checks against
  the actual app screen/provider: no-credential signed-out/no demo fallback and
  honest retry without manufacturing a session. The fixture route is registered
  to prove it is not reached when credentials are absent; no handler, session,
  identity or DB evidence is implied.
- `ourhoomu-front/README.md`: documented command, evidence boundaries, scope and
  exact required test-only seam. Existing demo config/suite is unchanged.

## Precise blocker / next action

Authenticated browser states for zero/one/many houses, persisted stale selection,
logout cache reset, authenticated account and house error paths cannot be set up
through current exported app root in a production web bundle. Required seam:
provide a test-only Expo Router root entrypoint which wraps the unchanged actual
router/screen tree in `AppRuntimeProvider` with a fixture `testRuntime`, only in
a separately configured development test bundle. It must not touch production
entrypoints, add a login bypass, expose credentials through public env/browser
bridges, or create backend test routes. Keep synthetic HTTP fixtures labelled as
fixtures. If the actual authenticated HTTP flow is required instead, wait for
real handlers and separate explicit synthetic DB/data-owner authorization.

Composition/reset units exist in `src/runtime/api-mode.test.ts`,
`src/repositories/house-selection.test.ts`, and
`src/runtime/operation-guard.test.ts`; those are unit evidence, not browser
acceptance. The signed-out browser suite does not close SW-0009 or AC1a/AC2.

## Verification record

Commands/outcomes (2026-10-16, source `aed0bd8c7aedde82431c3077de2a7e844056c9d2` plus the scoped harness changes):

- From `ourhoomu-front`: `bun run typecheck:e2e` — passed.
- From `ourhoomu-front`: `bunx --no-install playwright test --config=playwright.api.config.ts` — **2 passed**, dedicated Expo server on 18057 stopped by Playwright after run.
- Root `bun run format:check` — passed (workspace Turbo, frontend Prettier).
- `git diff --check` — passed.
- Initial failed attempts exposed invocation cwd/config resolution and honest no-credential state; corrected command and assertions. Final run is the result above.
- No screenshots were needed for the passing run. Failure artifacts in ignored `ourhoomu-front/test-results/` are not committed.

No API/Workers process, database, provider, production endpoint or credential was used. Browser `page.route` registrations are inert because session bootstrap stops at the absent local credential; tests assert zero fixture calls. This is signed-out UI evidence only. The `bunx --no-install playwright` form uses the frontend's existing pinned Playwright 1.64.1; initial root-cwd attempts were not used as test evidence.
