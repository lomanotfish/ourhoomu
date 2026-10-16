# SW-0055 secure credential component

Implemented source commit: `e0e58e7469b1dec2982b37c1478b2f4c2bbfcce4`.
Baseline: `1864cc584baf64f28b60c504e4ecb3ddc6605648`, isolated branch
`witchagorn/sw-0055-secure-v2`; integration target `local` remains Lead-owned.
Task `task_700bd38a3ebc`, Dispatch `ctx_534580e14583`, 2026-10-15.

## Component and boundary

- `src/session/secure-credentials.ts` implements the existing `CredentialStore`
  with an injected minimal storage port. One key `ourhoomu.session` stores one
  JSON `{ version: 1, session }` bundle. Refresh replacement performs one write
  containing both credentials; there are no separate token records or cache.
- Untrusted records require the exact envelope/session fields, version 1,
  nonempty printable ASCII tokens without spaces, UUID user ID, and a finite
  ISO datetime expiry. Expired access credentials remain loadable so the
  existing authority can refresh them. Invalid stored data is removed only
  from the owned key and returns `null` after successful deletion.
- `src/session/native-secure-credentials.ts` lazily imports SecureStore and
  binds service `app.ourhoomu.session`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, and
  `requireAuthentication: false` consistently for get/set/delete. No access
  group, biometrics, plaintext fallback or development auto-login is added.
- Native module loading/availability and read/write/delete failures become
  `CredentialStorageError` with fixed text and operation code. No raw native
  error, stored token, parser message or error cause escapes. Invalid saves
  reject before overwriting data. Failed cleanup/clear rejects instead of
  reporting success. The adapter adds no serializer; the existing authority
  retains ownership of ordering and refresh/logout races.
- No authority, client, contract, UI, auth flow, API, DB, board, checklist,
  ticket status or native app config changed. The demo is not wired to this
  authenticated storage component.

## Dependency evidence

Installed Expo metadata reports `expo: 57.0.28` and
`bundledNativeModules.json["expo-secure-store"]: "~57.0.4"`.
[Current official Expo SecureStore docs](https://docs.expo.dev/versions/latest/sdk/securestore/)
also recommend `~57.0.4`. Installed exact `57.0.4` using
`bun expo install expo-secure-store@57.0.4 --bun`, then retained only that
manifest addition and its three root lock additions. No other package version
changed. The installer automatically added its optional plugin to `app.json`;
that generated change was removed, leaving native configuration unchanged.

The native entrypoint exports successfully through Metro, including the actual
SecureStore import. A future native build must verify platform configuration,
Android backup exclusions where relevant, and actual device behavior. No
biometric permission/configuration or native build claim is made here.

## Verification on source commit

Bun `1.4.3`, Node `24.15.0`. Final checks used the source commit above;
only this report was added afterward.

| Check | Observed result |
|---|---|
| Root `bun install --frozen-lockfile` | Pass; 708 installs / 856 packages checked, no changes |
| Root `bunx turbo run typecheck typecheck:e2e test format:check lint check:generated export:web export:ios build:worker --force` | Exit 0; 15 successful tasks, 0 cached; 23.551s; frontend 92 + API 67 unit tests pass |
| Frontend `bun test ./src/session/` | 62 pass, 0 fail, 258 assertions across 3 files |
| Frontend `bun expo install expo-secure-store --check` | Exit 0; dependencies up to date |
| Frontend `EXPO_NO_TELEMETRY=1 bun expo export:embed --entry-file src/session/native-secure-credentials.ts --platform ios --dev false --bundle-output /tmp/sw0055-native-credentials.js --assets-dest /tmp/sw0055-native-assets` | Exit 0; component's iOS JS bundle written |
| Frontend `bunx playwright test --config /tmp/sw0055-playwright.config.ts` | Exit 0; 24 expected, 0 unexpected/skipped/flaky; 25.5s |
| `git diff --check` | Pass |
| `graft check` after final map | Exit 0; graph check OK |

The full online `bun expo install --check` exits 1 because existing pinned
Expo `57.0.28`, constants `57.0.21`, linking `57.0.12`, and router `57.0.26`
now lag the remote recommendations by one patch. SecureStore is not listed.
These four versions were already present at baseline; they remain unchanged
under this ticket's dependency scope. Owner for any separate patch refresh:
Lead/platform. The targeted package compatibility check passes.

## Test evidence and retries

The new storage suite has 37 tests and the native binding suite has 2 tests.
Tests first failed because the component was absent; native binding tests first
failed on eager React Native loading. Two additional token-boundary tests failed
for control/non-ASCII credentials, then passed after validation tightened.
Roundtrip, atomic refresh pair replacement, absent/clear, malformed JSON,
unsupported versions, malformed fields, unrelated records, invalid saves,
missing module, false/throwing availability, native read/write/delete errors,
corrupt-record cleanup failure, and error privacy are covered. An adapter-backed
race test confirms logout waits for an in-flight save and ends empty; all 23
existing authority tests also pass.

All native storage/module operation tests use explicitly injected fakes. They
prove JavaScript validation, exact binding options and errors, not actual native
keychain behavior. The component Metro export and full web/iOS exports prove
bundling only. Playwright covers existing in-memory demo desktop/mobile flows
and real local workerd health/CORS, not authenticated UI or real identity.

Lead reserved 18057/18058/18059 exclusively; `lsof` found no listeners before
binding and none after shutdown. Temporary config retains original tests,
dedicated listener ports and `reuseExistingServer: false`. The API fixture's
hard-coded CORS header origin remains `http://localhost:18047`; no listener on
18047 is used. The first temporary config lacked explicit server cwd and failed
before starting a server; correcting it ran all tests. A subsequent run had
21 pass / 3 CORS failures because the temporary config changed that fixture
origin; retaining the original API header origin produced 24/24. No repository
Playwright config or test source was changed.

## Runtime and Graft

Effective launch evidence: shell ancestry reaches PID 63892 with
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`; session
permissions are never/danger-full. Model was inherited without override.

🌱 Graft: ACTIVE in the exact assigned checkout. CLI `0.21.1`; initial
`graft map` and session `graft ask`/`grep`/`callers` located the existing
CredentialStore and authority-owned write queue before indexed source reads.
Raw reads were limited to returned source spans, unindexed docs/config/native
package metadata and newly created files. `graft check` initially found the
new files stale; `graft build --no-gitignore --no-ignore` refreshed the local
cache without project ignore edits. Final `graft map` reports 75 files,
366 symbols, 948 edges; subsequent `graft check` exits 0 with graph check OK.
Final map alone reports an estimated 136,788 tokens saved (one call); this is
Graft's estimate, not measured usage or a total across the earlier queries.
No fabricated aggregate savings is claimed and no Graft cache is committed.

## Handoff and limits

Evidence logs, final temporary Playwright config, JSON results, red/green token
tests, Graft output and source SHA are retained outside the worktree at
`/Users/afe/orca/artifacts/ourhoomu/SW-0055-secure-credentials/`.
The committed report and README remain after worktree cleanup.

The implementation is ready for independent review and Lead integration.
Actual iPhone keychain persistence, locked-device/error behavior, encryption,
restart/reinstall/backup, device build, VoiceOver/Dynamic Type and Google/Apple
login remain unproved and outside this component's evidence. There were no
provider, production, credential, external deployment or DB operations.
