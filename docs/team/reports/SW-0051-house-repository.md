# SW-0051 house repository component handoff

Implementation commit: `26c009d0102ee77572832ff5027a0f80ad5adbd6`.
Baseline: `ad99ebe55174e198a0ceedff018ec7b41b12142e`.
Worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0051-house-repository`.
Branch: `witchagorn/sw-0051-house-repository`.
Task: `task_c8312ce11acf`; Dispatch: `ctx_77309440497e`.
Worker: `term_2baa09d3-627e-40f5-8357-546c4b1875cf`.

## Implemented component

- `contracts.ts` aliases generated frozen OpenAPI schemas and list query types;
  repository return types derive directly from generated operation responses.
- `houses.ts` implements typed asynchronous list/create/detail/rename, members,
  invitation issue/accept/revoke, leave/remove-member and own recipient-account
  list/create/patch. Routes, methods, request bodies and response projections use
  frozen wire `7756bcc`. Account DELETE is absent from the contract and is omitted.
  Rename uses the full `HousePatch` including timezone and expectedVersion.
- IDs and caller idempotency keys must be UUIDs; resource segments are encoded.
  List limits are integer 1–100; opaque cursors are encoded and reject empty,
  control-character or malformed surrogate input. Version-bearing patch operations
  require positive safe integer expectedVersion. No key generation, actor inference,
  caching, persistent storage, conflict replay or offline mutation queue was added.
- `house-selection.ts` is pure and discriminated: invitation priority, create/join
  for zero houses, entry for one, explicit choice for many, authorized persisted
  entry and explicit recovery when a persisted choice is unavailable. Even when
  only one other house remains, a revoked choice never silently enters it.
  Caller must supply the **complete current authorized list after successful
  loading**; an individual paginated response is insufficient for selection.

## Authorized pagination correction

Initial inspection found accepted ApiClient discarded ListEnvelope.nextCursor.
Lead message `msg_6e2b04b1139a`, read at the implementation checkpoint, authorized
sole ownership of `src/api/client.ts` and `transport.test.ts`; amended SW-0051 was
read with `git show d3b6d79:docs/team/tickets/SW-0051.md` before editing them.

Additive `requestPage<TItem>` returns `{ data, nextCursor, requestId }` and checks
array data, string-or-null cursor, UUID request ID and exact envelope keys.
Existing `request<TData>` keeps data-only behavior. Both methods use the same
internal dispatch function, preserving bearer/session revision, one keyed 401
refresh replay, offline rejection, cancellation, actor protection, redirects and
HTTP errors. All three repository lists expose nextCursor, including null end.
No session/client authority semantics or generated DTOs were changed.

## Verification

Executed from `ourhoomu-front` on the code recorded in implementation commit:

| Command | Result |
| --- | --- |
| `bun run typecheck` | exit 0 |
| `bun run test` | exit 0; 53 pass, 0 fail, 383 assertions across 6 files |
| `bun run format:check` | exit 0; all matched files use Prettier style |
| `git diff --check` / staged diff check | exit 0 |
| `graft check` after retrieval refresh | exit 0; graph OK, 289 structure items |

Focused repository fixtures exercise all 13 operations through the accepted
ApiClient with synthetic fetch responses; verify exact methods/paths/bodies,
stable mutation headers, cursor encoding and metadata, unsafe ID/query/key/version
rejection before transport, conflict with no implicit retry, offline/cancellation
and unchanged network error propagation. Selection tests cover 0/1/many houses,
valid persisted choice and revoked choice recovery. Transport regressions cover
paged metadata, null end, malformed envelopes, unchanged data-only callers,
keyed 401 replay, typed forbidden error, offline/abort and unkeyed 401 safeguards.
Existing session/transport/demo/calendar tests remain passing.

Tests were written before implementation: first missing-module run failed, then
minimal stubs produced expected failed selection/request assertions; paged tests
failed against absent requestPage before the seam change. Initial typecheck could
not launch because this worktree lacked node_modules. Existing Lead frontend
package.json and bun.lock were checked byte-for-byte with `cmp` (both exit 0),
then its dependency tree was linked locally via an ignored node_modules symlink;
no dependencies were installed or changed. Later typecheck found a missing
createdAt fixture field and a union expectation typing issue; both were corrected
without suppressions before final checks passed. A test-edit helper substring
mismatch had no production effect; completed repository edits were verified again.
Prettier wrote only owned source/test files.

## Runtime and Graft evidence

Read Graft skill and software-tech-lead/references/agent-runtime.md before source
investigation. Codex tool shell parent PID `75033` was observed in actual process
argv as `codex --no-daemon --dangerously-bypass-approvals-and-sandbox`; session
permissions also specify never/danger-full-access. No model override or nested
worker was created.

🌱 Graft: ACTIVE — exact ticket worktree; `graft --version` → 0.21.1 (exit 0),
initial `graft ask "ApiClient request generated OpenAPI houses membership invites"
--source --in ourhoomu-front -n 5` succeeded with indexed relevant sources.
Additional source retrieval: two skeletons for types/DTO, one DTO grep, callers
`createApiClient --depth all`, one success-envelope query and a repository skeleton.
Raw reads were for unindexed docs/config and contract details absent/truncated in
retrieval. Initial final `graft check` reported STALE after edits; repository
skeleton refreshed four changed files, then `graft check` returned OK.
Tool-reported estimates total **137,263 tokens saved across six calls with savings
lines** (42,545 + 39,987 + 39,940 + 11,981 + 2,050 + 760); no measured cost claim.
The type-alias skeleton and checks reported no savings. Graph/cache stays ignored.

## Limits and next owner

This is fixture-tested component evidence only: no API handlers/DB, live network,
browser/UI, Google/Apple native login, providers, deployment or full SW-0009
acceptance is proved. UI integration must load all authorized pages, revalidate
membership and explicitly handle recovery; invitation state carries no secret.
Full schema validation/authority remains server-owned; typed data projections do
not independently validate every resource property at runtime.

Lead owns independent review, acceptance, integration, ticket/checklist changes,
worker release and worktree cleanup. Worker has not merged, pushed, deployed or
changed any UI, manifest, generated DTO, backend, DB, root or status file.
