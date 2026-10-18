# SW-0044 — typed transport and session authority

## Scope and baseline

- Worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0044-front-transport`, branch `witchagorn/sw-0044-front-transport`.
- Baseline: `0448bf91a2a49df94081fe3c0a31be46b4ee94e3`.
- Implemented the assigned transport/session fixture slice using generated `components['schemas']['Session']` and `components['schemas']['Error']` from SW-0042. No UI, generated DTO, manifest, lockfile, dependency, database, provider, native-login, deployment, or push changes were made.

## Implementation and acceptance evidence

- `src/api/client.ts` injects fetch/connectivity/session, validates HTTPS (with explicit loopback development opt-in), parses the `{data, requestId}` envelope, owns bearer authorization, blocks offline mutations before fetch, rejects body fields that would choose the actor, and performs at most one authorized 401 replay. The replay uses the same serialized JSON body and caller `Idempotency-Key`; unkeyed mutations are not replayed.
- `src/api/errors.ts` preserves generated typed error codes, HTTP status, request ID, `version_conflict.currentVersion`, and `Retry-After`; malformed envelopes produce a protocol error.
- `src/session/authority.ts` injects credential storage and direct refresh fetch. Concurrent unauthorized responses share a single refresh; one retry after network failure or 502/504 reuses the exact serialized refresh body and key. Generation checks and serialized credential writes make logout/account replacement win over late refreshes. Terminal refresh 401 clears credentials and invokes the authenticated-cache callback.
- Focused fixture tests cover success/error envelopes, HTTPS policy, no actor override, offline mutation denial, cancellation, exact replay, no refresh recursion, all requested typed status cases, shared refresh, exact refresh retry, logout/account-switch races, and terminal refresh 401.
- Actual native/provider/API integration remains pending under SW-0009 and the existing provider/native evidence gates. Fixtures do not establish real login or production transport behavior.

## Verification

From `ourhoomu-front/`:

- `bun install --frozen-lockfile` — passed; 575 packages installed from the existing lockfile.
- `bun run typecheck` — passed.
- `bun run format:check` — passed.
- `bun test src/api/transport.test.ts src/session/authority.test.ts` — passed, 15 tests.
- `git diff --check` — passed.
- Generated DTO files and package manifests/locks remain unchanged.

## Graft and runtime evidence

- `graft --version` returned `0.21.1`.
- An initial query reported that it copied the graph from `/Users/afe/Desktop/ourhoomu`, so it was not used as the exact-worktree index. `graft build --no-gitignore --no-ignore .` then built `/Users/afe/orca/workspaces/ourhoomu/sw-0044-front-transport/graft` from this worktree: 38 supported files, 150 nodes, 355 edges; the directory is ignored local cache.
- Exact-worktree retrievals: `graft grep "ErrorEnvelope|VersionConflict|RefreshRequest|Session|Authorization|Idempotency-Key|Unauthenticated" --in ourhoomu-front/src/api`, `graft ask "Bun test patterns and frontend module conventions" --in ourhoomu-front/src --source`, and final `graft grep "createApiClient|createSessionAuthority|refreshAfterUnauthorized" --in ourhoomu-front/src`. They reported approximately 35,110, 3,176, and 6,347 tokens saved, respectively; total reported savings: approximately 44,633 tokens across three exact-worktree retrieval calls. `graft check .` returned `graph check: OK` for the wiring graph; the optional deep meaning tier is not built. Markdown requirements/contracts were read directly because they are not indexed source.

## Coordinator clarification

The coordinator confirmed that non-history idempotency locators have a 24-hour window, history keys last through parent access expiry, invitation issuance exact retries last 5 minutes, and refresh exact-old-credential/key/body retries last 5 minutes before reuse revokes the family. This implementation keeps the immediate authorized request replay and the bounded refresh transport retry in separate lanes; it does not retry uncertain old writes or generate a new key for a replay.

## Handoff

No external API, native provider, database, or production evidence is claimed. Tech Lead should review the scoped diff and integrate; actual transport integration remains gated on the backend endpoint/runtime and native identity evidence.

## SW-0045 correction pass (2026-10-14)

The frozen SW-0045 report at `1f61e30` was read with `git show`; its six findings and runnable repro were used as the correction acceptance set. All six are addressed in the owned transport/session files:

- **R1:** requests capture the authority revision before loading the bearer token and pass it with a 401. Replacement, logout, and same-user re-login synchronously advance that revision; a late response from the old lineage cannot replay. A late 401 after same-session refresh still takes the current-token fast path. Integrated regressions cover both paths.
- **R2:** all credential loads and writes share one serialized queue. Replacement/logout advance revision at invocation before store I/O, and reads recheck revision after load. Deferred-load, deferred-save, deferred-clear, and replacement-versus-logout tests prove stale credentials are not returned or persisted after the newer operation.
- **R3:** the authority remembers the latest session lineage and will not downgrade it from a stale store snapshot. A delayed old snapshot after a completed rotation returns the rotated access token without another refresh request.
- **R4:** an uncertain refresh retains the exact old refresh token, idempotency key, serialized body, and injected-clock start time for at most five minutes. Recovery inside the window reuses the same attempt. After the window it clears the local session and sends no new-key request with the old credential. Regression fixtures model two lost responses, subsequent recovery, and expired uncertainty.
- **R5:** API initial/replay requests and refresh attempts set `redirect: 'error'`; retries preserve that option. A real Bun loopback 307 test confirms the second listener receives no credential body. This proves Bun behavior only. **Native transport integration remains gated on an adapter/conformance check proving redirects fail closed on each supported native runtime; no native behavior is inferred from Bun.**
- **R6:** ordinary success requires a UUID request ID. Refresh success validates required envelope ID, closed envelope/session keys, session primitive fields, UUID user ID, and date-time expiry. Error parsing requires a UUID request ID and validates closed envelope/error properties and the existing error union without validating generic endpoint DTO payloads.

Regression tests use valid UUID fixture IDs and preserve the existing same-family shared refresh, one-time replay, and independent caller cancellation behavior. Verification from `ourhoomu-front/` after the fixes:

- `bun test src/api/transport.test.ts src/session/authority.test.ts` — **30 passed, 0 failed, 117 assertions**.
- `bun run typecheck` — passed.
- `bun run format:check` — passed.
- `git diff --check` — passed.
- Generated DTO/types and frontend/root manifests and locks compare unchanged with the frozen HEAD.

No API/native integration, provider, database, deployment, push, or production claim is made. The corrected source is ready for the coordinator's independent frozen recheck; native redirect conformance remains an explicit integration gate.

### Correction-pass Graft evidence

**Graft: ACTIVE** in `/Users/afe/orca/workspaces/ourhoomu/sw-0044-front-transport` at baseline `f7dec000563b8995927832cfa65658d077497371`. `graft --version` returned `0.21.1`; `graft build --no-gitignore --no-ignore .` reported 43 supported files, 216 nodes, and 476 edges at the exact worktree path; `graft check .` reported the wiring graph in sync. Retrieval commands were `graft map .`, `graft grep 'createApiClient|createSessionAuthority|toApiError|parseRefreshSession' --in ourhoomu-front/src`, five `graft skeleton` calls for the assigned source/test files, and `graft callers createSessionAuthority --depth 2`. Graft's reported estimates sum to approximately **100,141 tokens saved across eight retrieval calls**; this is an index estimate, not a runtime or model-token measurement. Markdown project instructions/contracts were read directly because they are not indexed.

## SW-0045 second required fix pass (2026-10-14)

The immutable SW-0045 final report at `2bc18f3faac862bee29aaa12a0198664847f2c0a:docs/team/reports/SW-0045-transport-final.md` reported residual F1–F3 after its six original probes passed. This pass changes only `ourhoomu-front/src/session/authority.ts`, `ourhoomu-front/src/session/authority.test.ts`, and this report. Source/test commit: `efb9019bab10e18f7f7d64ffb1526343a61528f7` (`Guard refresh completion ownership`).

- **F1:** Refresh completion now rechecks captured generation and exact flight ownership after the credential save await before publishing `knownSession` or clearing the retained attempt. Deferred-save regressions cover both logout and account replacement; the next integrated `/v1/me` request is rejected without a bearer after logout and sends B's bearer after replacement. The serialized store ends at null/B in both cases.
- **F2:** Terminal 401 and uncertain-attempt updates require the matching generation, flight owner, and exact attempt before changing shared state. The held A-401/B-lost-response regression verifies B's subsequent refresh requests retain B's original key and exact body after A completes.
- **F3:** A deadline check now runs immediately before every initial or retry refresh fetch, including retries after network errors and 502/504 responses. If the owned attempt expires in flight, the authority clears only that current session and returns null without dispatching another request. The injected-clock regression advances 300001 ms during the first failed fetch and observes one call and a cleared store.
- The previous six corrections and existing same-family rotation behavior remain covered; no assertions were suppressed.

Verification from `ourhoomu-front/`:

- `bun install --frozen-lockfile` — passed; 612 installs checked, no changes.
- `bun run typecheck` — passed.
- `bun run format:check` — passed.
- `bun test src/api/transport.test.ts src/session/authority.test.ts` — **34 passed, 0 failed, 134 assertions** (30 pre-existing tests plus four new cases).
- `bun test` — **41 passed, 0 failed, 165 assertions** across four files.
- `git diff --check` — passed. Generated DTOs, manifests and lockfiles compare unchanged with the pre-fix HEAD.

The existing redirect test exercises Bun loopback behavior only; it does not establish native redirect or secure-storage behavior. Native conformance and actual API/provider/database effects remain separate gates. No native integration, provider, database, production, deployment or push operation was performed.

**Graft: ACTIVE** in this assigned worktree. `graft --version` returned `0.21.1`; from `ourhoomu-front/`, `graft build --no-gitignore --no-ignore .` reported 32 supported files, 208 nodes and 461 edges at `ourhoomu-front/graft`, and `graft check .` passed. The optional deep tier is not built. Initial exact-worktree `graft map .` and `graft grep 'createSessionAuthority|retryRefreshFetch|uncertainAttempt|knownSession|replaceSession' --in ourhoomu-front/src` reported estimates of 88,225 and 6,665 tokens saved; the final focused retrieval reported 9,147. Total reported estimate: **104,037 tokens across three retrieval calls**; these are Graft estimates, not measured model-token or runtime reduction. Project Markdown and the frozen independent report were read directly because they are not indexed source.

This worker's artifact is ready for the coordinator's fresh independent frozen review. No SW-0044 acceptance or integration status is claimed here.
