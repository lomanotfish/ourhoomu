# SW-0009 generation guard delta review: fde5587

TASK: Recheck the two grouped blockers from `SW-0009-review-4578a32.md` against exact implementation commit `fde5587`.

STATUS: UI changes requested. Canonical bootstrap/session correction remains approved within the synthetic component boundary. No full SW-0009 acceptance.

## Observed improvements

All asynchronous screen handlers now construct the reusable guard and inspect it before delayed writes, error handling, and stale reload calls. Previously listed captured-auth comparisons are gone. Logout immediately clears local UI and guards delayed remote completion against identity changes. `clearAuthenticatedData` and `clearHouseData` now reset busy, preventing the prior terminal-401 busy lock. These are actual screen integrations, not conclusions inferred from helper tests alone.

## Remaining blockers

### 1. House selection now rejects its own valid response

SEVERITY: HIGH

FILE: `ourhoomu-front/app/api.tsx`

LOCATION: `loadHouseDetail` lines 139–146, 154, 164, 178–179; selector line 621.

ISSUE: The request to select a house requires `activeHouseIdRef.current === house.id` before the response is allowed to set the active house. The selector only calls `loadHouseDetail(house)`; it does not establish that requested house as active first.

IMPACT: With multiple houses and no current selection, choosing a house always discards its valid response. Switching from A to B also discards B. The same false predicate skips busy cleanup, disabling subsequent actions indefinitely.

RECOMMENDED_FIX: For the selection request, guard with current auth and selection/request generation rather than already-active house identity. Alternatively establish a separate requested-house reference synchronously and check that reference. Preserve active-house identity guards for mutations of an existing selection. Add a meaningful selection completion regression test, including first selection and A-to-B.

### 2. External auth-generation reset retains old account editing data

SEVERITY: MEDIUM

FILE: `ourhoomu-front/app/api.tsx`

LOCATION: auth/runtime effect lines 42–55 versus explicit clear lines 68–72 and account editor inputs.

ISSUE: The auth/runtime reset clears loaded accounts but does not clear `accountEditing`, label, bank code, account number or default flag. Only the explicit clear handler resets them. External identity replacement can therefore expose the preceding identity's account form values or leave the editor targeting its account ID.

IMPACT: Sensitive form data can remain visible to a newer identity; a save can target an obsolete account identifier.

RECOMMENDED_FIX: Include the same account-editing/form reset in the auth/runtime invalidation effect, preferably through one shared reset operation, without removing the busy reset.

## Independent verification

- Exact isolated workspace: `/Users/afe/orca/workspaces/ourhoomu/review-frontfde5587`, clean source `fde5587` before report creation.
- `bun test --timeout 10000 src/session/api-session.test.ts src/session/authority.test.ts src/session/native-secure-credentials.test.ts src/runtime/operation-guard.test.ts` from `ourhoomu-front`: **37 passed, 0 failed, 128 assertions**, Bun 1.4.3.
- Executed the actual imported guard through `bun -e` with unchanged auth/request generation, requested house B, current active house null. Result: `{"validSelectionCompletionAllowed":false,"finallyClearsBusy":false}`. This is a minimal helper-level demonstration matching the actual screen wiring; it is not a mounted screen/browser test.
- `git diff --check`: **passed** before report creation.
- Source inspection confirms the canonical bootstrap implementation remains unchanged from the prior bounded approval.
- App SHA-256: `bbcbac14ffcdf6cb6be6d00f767ec96c4623fec61e6bf38ad902c36873451d04`.
- Guard SHA-256: `1d65bd29728654b1277d87154ddcc9a246391f18f66701b1d477fb767f01d865`.
- Session source SHA-256: `8f16d3657d8e494cf587693a07714153ab48df96688bea8d40e01981b6d000a8`.
- Graft first: `graft grep "createOperationGuard" --in ourhoomu-front`, observed 20 occurrences across 13 symbols / three files; estimated savings 8,152 tokens. Direct source inspected because full settlement/control flow was needed.
- No database/provider requests, native/device check, real authenticated HTTP acceptance or browser rendering performed. Owner-reported broader checks were not substituted for independent execution.

CHANGED_FILES: This report only.

ISSUES: Two bounded blockers above.

NEXT_ACTION: Pi frontend owner corrects selection guard and auth-form reset, then exact-commit delta verification. Tech Lead owns integration and authoritative status.
