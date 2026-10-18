# SW-0061 independent secure credential storage review

## Verdict: changes_requested

One **High / required** finding blocks acceptance of SW-0055's failure-safe
deletion requirement. JavaScript tests and component bundling pass, but the
installed iOS dependency can resolve a deletion without deleting the record.
No implementation changes were made during this review.

Reviewed source: `e0e58e7469b1dec2982b37c1478b2f4c2bbfcce4`.
Frozen checkout/report: `0018ef4335ec469ea4a7fc4d1f7fcb126e982ba4`.
Comparison base: `1864cc584baf64f28b60c504e4ecb3ddc6605648`.
The complete `1864cc5..0018ef4` diff contains eight files, 582 insertions and
no deletions; both commits and connected CredentialStore/authority code were
reviewed. Branch: `witchagorn/sw-0061-secure-review`; integration remains
Lead-owned. Review date: 2026-10-15.

## Required finding

### S1 — High: successful clear does not establish native deletion

Locations: `ourhoomu-front/src/session/secure-credentials.ts:34-40,66-67,84-86`
and `ourhoomu-front/src/session/native-secure-credentials.ts:32-35`.
Installed dependency: `expo-secure-store@57.0.4`,
`ios/SecureStoreModule.swift:43-51` and `src/SecureStore.ts:128-135`.

`remove()` treats a fulfilled `deleteItemAsync()` as successful deletion.
The installed Swift handler calls `SecItemDelete` for the legacy, authenticated
and unauthenticated aliases at lines 48-50 and discards every returned status.
Its JavaScript wrapper only awaits that native handler. An OS deletion failure
therefore need not reject the promise; the adapter has no absence check.

The independent injected-native probe deliberately resolves deletion while
retaining the record, modeling this unchecked-status path. It confirms:

1. Save a valid session and refresh it through the real SessionAuthority.
2. Let the native delete resolve without changing the stored value.
3. `authority.logout()` resolves and its current in-memory state returns null.
4. A freshly constructed adapter reloads the complete retained rotated session,
   including its refresh credential.
5. With a corrupt record instead, `load()` returns null after its purported
   cleanup while the corrupt record remains present.

This is a persisted credential removal failure hidden by a successful logout.
Backend revocation remains authoritative, but this component cannot assume it
occurred: the accepted authority's logout is a local clear. Existing tests only
model successful removal or rejected deletion and miss fulfilled-but-ineffective
deletion. The README/report's unconditional failed-deletion guarantee is
therefore stronger than the installed implementation supports.

Required remedy for the implementation owner: after deletion, verify that the
owned key is absent using the same native service/options. Reject with an opaque
typed deletion error if a value remains or verification cannot complete; apply
the same rule to corrupt-record cleanup. Keep ordering in SessionAuthority,
without another queue/cache, and add regression coverage for a fulfilled no-op
delete and a failed verification read. This closes the demonstrated JS false
success path when native reads accurately report presence; it does not itself
prove native Keychain behavior. Alternatively, provide a reviewed native path
that checks deletion statuses rather than discarding them. Do not silently
change dependency versions under this review.

Evidence: `independent-probes.log` and `independent-probes.ts` in the artifact
directory below; preserved exact dependency sources
`installed-SecureStoreModule.swift` and `installed-SecureStore.ts`. This is a
source-backed failure-path finding plus an injected reproduction, **not an
observed device failure**, and does not assert which OS condition triggers it.

## Remaining security assessment

- One owned `ourhoomu.session` record holds `{ version: 1, session }`; each save
  writes the complete access/refresh pair in one storage operation. There is no
  token split, second session cache, additional write queue, fallback storage,
  biometric request or eager native import.
- Untrusted JSON requires a non-array object, version 1, allowed envelope and
  session fields, nonempty printable ASCII tokens, a supported UUID shape and
  finite parsed ISO-shaped expiry. Required fields are checked by value as well
  as the allowed-key filter. Invalid saves reject before writes. Expiry checks
  deliberately do not compare against now: an explicit year-2000 session loaded
  and refreshed through the real authority in the independent probe.
- Corrupt/version-mismatched records target only the owned key. Their deletion
  completion guarantee is blocked by S1; unrelated entries are otherwise
  preserved. Native binding uses `app.ourhoomu.session`,
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, and `requireAuthentication: false` for every
  get/set/delete, without an access group.
- Native import/availability failures and rejected read/write/delete operations
  become fixed-message `CredentialStorageError` values with operation codes,
  without raw causes, parser errors, stored values or secret logging. Independent
  probes verified lazy import failure for load/save/clear. This exception
  handling does not cover the dependency's silent deletion failure.
- Existing authority ownership, generation checks, refresh single-flight,
  replay window, serialized storage and logout/replacement races are unchanged.
  All 23 existing authority tests and the new adapter-backed in-flight-save
  logout test pass. No UI wiring or native login was introduced.

## Dependency and scope review

Installed metadata independently reports Expo `57.0.28`, bundled SecureStore
range `~57.0.4`, and installed exact SecureStore `57.0.4`.
The [official Expo SecureStore documentation](https://docs.expo.dev/versions/latest/sdk/securestore/)
also recommends `~57.0.4`; its API describes matching service options and
unlocked, device-bound accessibility. It documents platform payload limits,
iOS reinstall persistence, and Android backup considerations. These are platform
expectations, not device acceptance from this review.

The root lock diff contains only three added lines: the frontend dependency,
a blank separator, and its resolved package entry/integrity. No existing package
version changed. The frontend manifest adds only the exact dependency; app
configuration, authority/client/DTO, API/DB and status files are unchanged.
The targeted SDK check passes. The source report's full online SDK check
reported four pre-existing patch recommendations; that broader check was not
rerun or interpreted as this component's failure.

## Independent verification

All checks used frozen `0018ef4` before adding this report, Bun `1.4.3` and
Node `24.15.0`. Dependencies were initially absent; a first metadata lookup
reported module-not-found, then the root frozen install succeeded without
tracked manifest/lock changes. No test server was started or reused.

| Command / check                                                                                                                                                                                                                       | Result                                                                                                  | Artifact                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------ |
| Root `bun install --frozen-lockfile`                                                                                                                                                                                                  | Exit 0; 700 packages installed                                                                          | `install.log`            |
| Frontend `bun test ./src/session/`                                                                                                                                                                                                    | Exit 0; 62 pass, 0 fail, 258 assertions                                                                 | `sessions.log`           |
| Frontend `bun test ./src`                                                                                                                                                                                                             | Exit 0; 92 pass, 0 fail, 563 assertions                                                                 | `frontend-unit.log`      |
| Frontend `bun run typecheck`                                                                                                                                                                                                          | Exit 0                                                                                                  | `typecheck.log`          |
| Frontend `bun run format:check`                                                                                                                                                                                                       | Exit 0                                                                                                  | `format.log`             |
| Frontend `EXPO_NO_TELEMETRY=1 bun expo install expo-secure-store --check`                                                                                                                                                             | Exit 0; up to date                                                                                      | `targeted-sdk.log`       |
| Frontend `EXPO_NO_TELEMETRY=1 bun expo export:embed --entry-file src/session/native-secure-credentials.ts --platform ios --dev false --bundle-output <artifact-dir>/native-credentials.js --assets-dest <artifact-dir>/native-assets` | Exit 0; 417 modules, bundle written                                                                     | `metro.log`              |
| Root `bun -e` with preserved `independent-probes.ts` contents                                                                                                                                                                         | Exit 0; expired-session refresh, fresh adapter, options and import-error assertions pass; S1 reproduced | `independent-probes.log` |
| `graft check`                                                                                                                                                                                                                         | Exit 0; wiring graph in sync, meaning/deep layer not built                                              | `graft-check.log`        |
| `git diff --check`                                                                                                                                                                                                                    | Exit 0 before report; rerun before commit                                                               | Git verification         |

The session suite includes 37 storage tests, two native-binding tests and 23
authority tests; its 62 tests are a subset of the 92 frontend tests, not an
additional total. The native ports in both committed tests and independent
probes are injected fakes. Metro proves native module bundling, not Keychain
execution. No source mutation tests were performed because the review checkout
is frozen and code/test edits are prohibited.

The producer's 15 root tasks, 159 combined API/frontend unit tests and 24
Playwright tests remain producer evidence at
`/Users/afe/orca/artifacts/ourhoomu/SW-0055-secure-credentials/`.
Those demo/workerd tests were not repeated: S1 concerns native storage and the
existing browser flows do not exercise it. Neither that evidence nor this
review proves actual device encryption, locked-device/read/delete failure,
restart/reinstall/backup behavior, native build, VoiceOver/Dynamic Type, or real
Google/Apple identity. These native/provider acceptance gates remain open.

## Runtime, Graft and handoff

Task `task_c7c2f428cc14`; Dispatch `ctx_2a56857545c1`.
Actual process evidence: PID 4213 runs
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`;
session permissions are never/danger-full, with inherited model and no override.

🌱 Graft: ACTIVE in
`/Users/afe/orca/workspaces/ourhoomu/sw-0061-secure-review`, CLI `0.21.1`.
Initial `graft grep CredentialStore` searched 75 indexed files and returned
16 hits in 11 symbols. Subsequent exact-checkout callers/grep/ask queries traced
authority ordering and validation helpers before source inspection; complete
source spans were then read to assess behavior. Docs/config and installed
dependency sources use raw reads because they are outside indexed app source.
Final `graft check` exits 0 with wiring graph in sync. Six retrieval calls
reported savings estimates of 12,459, 12,459, 3,824, 10,841, 2,633 and 4,466:
46,682 tokens in total, a tool estimate rather than measured usage. No graph
cache is committed.

Durable independent evidence:
`/Users/afe/orca/artifacts/ourhoomu/SW-0061-secure-review/`, including full
`reviewed.diff`, `reviewed-sha.txt`, dependency metadata, native source snapshots,
runtime proof, check logs and bundle. Only this report is an owned repository
change. S1 was escalated and acknowledged by the Lead; implementation owner
must correct it and obtain independent re-review before acceptance/integration.
No DB/provider/deployment operations, status updates, merges, cleanup or nested
workers were performed.
