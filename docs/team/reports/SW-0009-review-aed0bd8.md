# SW-0009 final bounded frontend delta review: aed0bd8

TASK: Independently recheck the two remaining findings from `SW-0009-review-fde5587.md`, preserving the previously reviewed session and mutation guards.

STATUS: **APPROVED within the bounded API client/UI source and synthetic component boundary.** No remaining blocker from this review gate. This does not close full SW-0009 or establish authenticated browser, database, native identity/device, provider or release acceptance.

## Exact source and corrections

- Isolated review workspace: `/Users/afe/orca/workspaces/ourhoomu/review-frontaed0bd8`.
- Source commit: `aed0bd8c7aedde82431c3077de2a7e844056c9d2`, clean before report creation.
- `ourhoomu-front/app/api.tsx` SHA-256: `c7d1930f93b8b11e12ca101fd283e32d4a478bdcb653f8ca1c73a6f8b867a49f`.
- Inspected the exact `fde5587..aed0bd8` delta and actual screen wiring, not only helper tests.

### House selection finding closed

`loadHouseDetail` now increments `dataGeneration` and constructs its guard using live request/auth generation only. It no longer requires the requested house to already be active. Thus a valid response can commit when active house is null or when changing A to B. A later C selection advances the generation and invalidates B; logout/identity invalidation advances the generation and prevents pending selection data from committing. State writes, error handling and finally remain guarded. Existing-house mutations retain their active-house guard.

New deferred selection tests cover initial null, A-to-B, rapid B-to-C, and pending selection after logout. Those tests exercise the imported guard in synthetic selection control flow; source inspection separately confirms the real screen uses that same guard configuration. They are not mounted React/browser tests.

### Auth form/busy finding closed

The screen now uses one `resetAuthenticatedData` implementation from both the auth/runtime effect and explicit clear. It increments both generations, resets busy/error and loaded authenticated data, and invokes `clearAccountForm`. That helper clears the account editing object, label, bank code, account number and default flag. Consequently external identity invalidation and explicit terminal authorization cleanup both clear the sensitive form values. Obsolete finally blocks remain unable to reset newer operations.

### Prior bounded approvals preserved

The correction does not change canonical bootstrap/session source or the previously added live guards on mutation/logout continuations. These remain within the prior bounded source approval, reinforced by the independently repeated session tests.

## Independent verification

Executed using Bun 1.4.3 in the isolated source workspace:

- From `ourhoomu-front`: `bun test --timeout 10000 src/session/api-session.test.ts src/session/authority.test.ts src/session/native-secure-credentials.test.ts src/runtime/operation-guard.test.ts`: **41 passed, 0 failed, 136 assertions**.
- From `ourhoomu-front`: `bun test --timeout 10000 src`: **117 passed, 0 failed, 671 assertions**.
- `git diff --check`: **passed** before report creation.
- Graft queried for guard/reset wiring before detailed control-flow inspection. The final narrow reset query displayed an estimated 7,809 tokens saved; an earlier folded query did not expose a reliable additional tally.

No database/provider requests, real authenticated HTTP/browser flow, native startup/device check, or external publication was performed. Typecheck, formatting and exports reported by the implementation owner were not rerun in this bounded review; they are not represented here as independent reviewer execution.

CHANGED_FILES: This report only.

ISSUES: No remaining blocker in the assigned delta/generation gate. Broader acceptance remains separate as described above.

NEXT_ACTION: Tech Lead may integrate the exact reviewed source after its required integration checks and record bounded acceptance without closing unverified browser/native/provider requirements.
