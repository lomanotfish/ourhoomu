# SW-0055 S1: verify secure credential removal

Implementation correction for the High finding in
[SW-0061](SW-0061-secure-storage-review.md). Independent S1 recheck and Lead
acceptance/integration remain required. No real-device acceptance is claimed.

## Source and scope

- Baseline: `aebcc5957c201250d754fee06dfa20168e99b3bf`, containing source
  `e0e58e7469b1dec2982b37c1478b2f4c2bbfcce4` and the independent review report.
- Branch/worktree: `witchagorn/sw-0055-secure-v2`,
  `/Users/afe/orca/workspaces/ourhoomu/sw-0055-secure-v2`.
- Task `task_b9b54e15178d`; Dispatch `ctx_6005e960548b`.
- This resumed checkout already contained four scoped dirty draft files. Their
  complete initial diff was preserved as `inherited-draft.diff` before editing.
  This attempt reproduced baseline failures, verified the minimal draft fix,
  refined the README limitation, and produced this report and scoped commit.
- Tested implementation blob: `6f9b18fb26f87fcd6ed14350b88c1f535d12e934`
  (`git hash-object ourhoomu-front/src/session/secure-credentials.ts`). Final
  commit/source SHA is recorded in `tested-sha.txt` and the worker settlement.

Only the credential module, its two test files, the frontend storage README
paragraph and this report change. Authority, client, UI, DTO, API, DB, manifests,
lockfile and project status remain unchanged. No dependencies were upgraded.

## Cause and correction

Installed `expo-secure-store@57.0.4` iOS `SecureStoreModule.swift:43-51` calls
`SecItemDelete` three times and discards its return statuses. Thus fulfillment
of the native deletion promise does not establish that the record is absent.

The shared `remove()` helper now awaits deletion and then reads the same owned
key. It completes only when that read returns `null`. A retained value or failed
verification read becomes `CredentialStorageError` with code `delete` and the
fixed message `Secure credential storage failed`, without raw values or causes.
Both explicit clear and corrupt-record cleanup use this helper. The native
binding supplies the same `app.ourhoomu.session` service, device-only unlocked
accessibility and authentication options for the verification read, as for
the deletion. Authority-owned serialization is unchanged; no queue or cache
was added.

The fix detects failure; it cannot force an unsuccessful native deletion to
succeed. In the retained-record regression, logout rejects and current memory
is cleared, but a fresh authority can still reload the retained rotated session.
The test deliberately proves that condition and its opaque failure signal,
then restores effective deletion and verifies a later restart has no session.

## Regression proof and checks

Environment: Bun `1.4.3`, Node `24.15.0`. Tests use injected storage/native fakes
and the real, unchanged SessionAuthority; they are not native Keychain tests.
All commands below ran in `ourhoomu-front/` unless identified as root commands.

Before applying the correction, only the four added verification lines were
temporarily removed from the preserved draft. Focused tests then exited 1:
**38 pass, 6 fail, 189 assertions**. Five new regressions received successful
completion where a typed deletion failure was expected: retained credential,
failed verification read, retained corrupt record, unreadable corrupt cleanup,
and retained rotated refresh credential after logout/restart. The sixth failure
was the updated native-binding expectation for the verification read.

After restoring the four-line fix:

| Command | Result |
| --- | --- |
| `bun test ./src/session/` | Exit 0; 67 pass, 0 fail, 300 assertions |
| `bun test ./src` | Exit 0; 97 pass, 0 fail, 605 assertions |
| `bun run typecheck` | Exit 0 |
| `bun run typecheck:e2e` | Exit 0 |
| `bun run format:check` | Exit 0 |
| `EXPO_NO_TELEMETRY=1 bun expo install expo-secure-store --check` | Exit 0; dependencies up to date |
| `bun run export:web` | Exit 0; exported `dist/web` |
| `bun run export:ios` | Exit 0; exported `dist/ios` |
| `EXPO_NO_TELEMETRY=1 bun expo export:embed --entry-file src/session/native-secure-credentials.ts --platform ios --dev false --bundle-output <artifacts>/native-credentials.js --assets-dest <artifacts>/native-assets` | Exit 0; iOS component bundle, 347 modules |
| Root `git diff --check` | Exit 0 |
| Root `graft check` | Exit 0; wiring graph in sync, deep layer not built |

Installed metadata remains Expo `57.0.28`, SecureStore `57.0.4`, bundled
SecureStore range `~57.0.4`. Dependency compatibility and the native component
bundle pass without manifest/lock changes. The 24 browser demo tests were not
rerun: they do not exercise this native storage component. No API/DB test server
or provider operations were needed.

Real-device locked/unlocked reads and deletion, physical Keychain persistence,
restart/reinstall/backup behavior, native builds and real Google/Apple login
remain separate evidence gates. Verification relies on the native read accurately
reporting presence. The README now states that limit explicitly.

## Runtime, Graft and handoff

Actual worker PID `58494` runs
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`, with inherited
model and no command-line model override. Effective session permissions are
`approval_policy = never`, `sandbox_mode = danger-full-access`.

🌱 Graft: ACTIVE in this exact worktree, CLI `0.21.1`. Initial
`graft grep createSecureCredentials` searched 75 indexed files and returned no
hits; the corrected `graft grep remove --in ourhoomu-front/src/session` searched
six indexed files and returned ten hits in five symbols across three files.
The latter reported an estimated 7,072 tokens saved; only one retrieval call
reported savings. Relevant source spans were then inspected. Documentation,
config and installed native dependency reads used raw files because they are
outside indexed application source. Final `graft check` passes. No graph cache
is committed.

Durable artifacts:
`/Users/afe/orca/artifacts/ourhoomu/SW-0055-secure-credentials-fix-ctx_6005e960548b/`.
They include baseline/inherited diff, red and green test logs, frontend check
logs, native bundle/source snapshot, runtime evidence, final diff and tested SHA.
Independent S1 recheck and integration are owned by the Lead; this worker did
not merge, clean up worktrees, update project status or open nested workers.
