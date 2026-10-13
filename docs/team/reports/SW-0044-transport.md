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
