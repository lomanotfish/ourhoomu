# SW-0009 frontend API operation race-guard report

Status: implementation and focused local checks complete; no commit created. Scope: `ourhoomu-ui-generation-all-mutations`. Preserved the pre-existing dirty `ourhoomu-front/app/api.tsx` changes and completed authenticated operation settlement guards.

## Changes

- Added `src/runtime/operation-guard.ts`, a small reusable predicate for request/data generation, live auth revision, and optionally the active target house.
- Added deferred-completion helper tests covering obsolete auth and request generations, changed/cleared target houses, and non-house-scoped operations.
- Applied current-generation checks to house creation, invitation acceptance/issue/revocation, leave, rename, account loading/save/archive, and logout. Catch/finally paths are guarded, and house-scoped work checks the live house ID. Existing bootstrap/detail flows use live auth-revision comparisons; house detail also checks its target.
- Auth-generation/runtime changes invalidate outstanding request generations and clear signed-in data; busy state is reset on invalidation. Logout completion cannot route/clear state belonging to a newer auth generation.
- No session authority/client/storage, contract, manifest, lockfile, backend, or database changes.

## Verification

Executed in `ourhoomu-front` using Bun 1.4.3:

- `bun run typecheck`: passed.
- `bun test ./src`: passed, 113 tests / 663 assertions.
- `bun test ./src/runtime/operation-guard.test.ts ./src/session/`: passed, 79 tests / 344 assertions. Session authority/API-session/native-storage suites are unchanged and pass.
- `bun run format:check`: passed.
- `bun run export:web`: passed; non-fatal `NO_COLOR`/`FORCE_COLOR` environment warnings only.
- `bun run export:ios`: passed; JavaScript/Hermes bundle only, not native build/device evidence.
- `git diff --check`: passed.

Tests are local synthetic/deferred helper and existing session fixtures; no API server or database was used. No Playwright API-backed authenticated house flows were run. Native/provider identity, real handler/database acceptance, and device behavior remain unverified and require their separate gates.

## Changed files

- `ourhoomu-front/app/api.tsx`
- `ourhoomu-front/src/runtime/operation-guard.ts`
- `ourhoomu-front/src/runtime/operation-guard.test.ts`
- `docs/team/reports/SW-0009-v4-integration.md`
