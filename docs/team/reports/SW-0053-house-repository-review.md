# SW-0053 independent house repository review

Verdict: **approve** for the bounded SW-0051 typed component and pagination seam.
No blocking correctness, security, contract or compatibility finding was reproduced.
This does not accept real house UI/API/native integration or complete SW-0009.

## Frozen scope and authority

- Reviewed implementation: `26c009d0102ee77572832ff5027a0f80ad5adbd6`.
- Tested checkout/report baseline: `388f21ff771e9749219ab9e51959977d44ce4ebc`;
  implementation parent: `ad99ebe55174e198a0ceedff018ec7b41b12142e`.
- Exact worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0053-house-review`, branch
  `witchagorn/sw-0053-house-review`. Only this report is changed/committed.
- Read the assigned full ticket from `/Users/afe/Desktop/ourhoomu/docs/team/tickets/SW-0053.md`,
  checkout AGENTS instructions, requirements, board, domain, API contract,
  core API contract, approved implementation scope, agent/runtime/Graft guides,
  and `SW-0051-house-repository.md` source-owner handoff.
- Independent inline correctness/compatibility reviewer role; inherited configured
  default model, no override or nested workers. Actual tool-shell parent PID
  `92500` appeared as `codex --no-daemon --dangerously-bypass-approvals-and-sandbox`;
  session permissions also state never/danger-full-access. No provider, database,
  deployment, merge, ticket/status or cleanup action was taken.

## Contract and implementation assessment

Compared all 13 repository operations against parsed frozen `docs/project/openapi.yaml`
(accepted wire revision `7756bcc`) and generated `src/api/dto.ts` operations.
`src/repositories/contracts.ts:1` aliases generated types rather than redefining
wire DTOs. `src/repositories/houses.ts:86` uses the exact methods/routes, required
bodies, and data projections: house list/create/detail/patch, member list,
invitation issue/accept/revoke, leave/remove-member, and own-account list/create/patch.
House patch includes timezone and expectedVersion; leave/remove return Member;
issue returns InvitationIssued, revoke returns token-free InvitationMetadata.
No unsupported account DELETE is exposed. Both account and house patch retain
positive safe-integer version checks.

`houses.ts:33` rejects unsafe explicit UUID resource IDs and caller keys before
transport; encoded segments cannot introduce another path/query. `houses.ts:43`
builds list query with URLSearchParams, preserves opaque Unicode/reserved cursor
characters, rejects control characters/unpaired surrogates, and bounds integer
limits to 1–100. Keys remain caller-owned across retries; the repository generates
no replacement key, infers no actor, and replays no conflict or uncertain write.
Actor-field injection is rejected recursively by the accepted client boundary.
Resource/body schema validation and authorization remain server responsibilities;
the adapter does not claim complete runtime DTO validation.

`src/api/client.ts:63` extracts the existing dispatch without changing its bearer,
session-revision, offline mutation, abort, origin/redirect, error parsing, or
one-refresh replay conditions. Both data-only request and requestPage use that
same dispatch. Existing data-only callers continue to receive just data.
`client.ts:126` preserves data, requestId and nextCursor, including an exact null
end marker. It rejects non-array data, missing/non-string/non-null cursor,
invalid requestId, malformed JSON and unexpected outer keys. Successful HTTP
status alone cannot turn a malformed page into a valid result. Error privacy
and typed HTTP/version conflict behavior remain unchanged; no new persistence,
cache, offline queue or retry policy was added.

`src/repositories/house-selection.ts:10` explicitly requires a complete, current,
successfully loaded authorized list. Invitation takes priority; absent choice
produces create/join, enter or choose for zero/one/many houses. A persisted choice
enters only when still present. An unavailable choice returns recovery even if
zero houses or one different house remains, with no silent fallback. This pure
helper intentionally neither loads pages nor establishes current membership;
the eventual UI owner must fulfill that precondition and handle recovery.

## Fresh verification

Runtime: Bun `1.4.3`, Node `v24.15.0`. Installed frontend and backend dependencies
independently with `bun install --frozen-lockfile` in each frozen package;
both exited 0, with no tracked manifest/lockfile/source changes or ambient
node_modules symlink reuse. Frontend commands below all exited 0. Final check
logs were retained after independent probes to make the evidence durable.

| Command | Observed result |
| --- | --- |
| `bun run typecheck` | passed |
| `bun run typecheck:e2e` | passed |
| `bun run format:check` | all matched files formatted |
| `bun run test` | 53 passed, 0 failed; 383 assertions, 6 files |
| `bun run test:e2e` | actual Playwright: 24 expected/passed; 0 skipped, unexpected or flaky; 27.816 s |
| `bun negative-probes.ts` (artifact script below) | 18 independent negative/boundary scenarios passed |
| `git diff --check` | passed |

The Playwright run started with `lsof -nP -iTCP:18047 -iTCP:18048 -iTCP:18049
-sTCP:LISTEN` empty. The frozen config used managed Expo and actual local workerd
servers with reuseExistingServer=false; all 20 desktop/mobile Chromium demo
cases and four workerd HTTP cases passed. Suite exit was 0, and the same lsof
check was empty after managed teardown. No unrelated listener was reused/stopped.

Independent artifact probes used the real frozen client/repository/selection
functions with synthetic fetch responses, without editing tracked tests/source.
They cover seven malformed page shapes, malformed success JSON with no raw-byte
leak/no retry, session revision 17 forwarded to a refresh that refuses replay,
abort during refresh preventing replay, repeated 401 capped at two requests with
redirect:error, nested actor injection rejected before fetch, control/surrogate
cursor and non-finite limit rejection, and revoked empty-list/invitation/null-choice
selection boundaries. All passed. Existing session tests additionally exercise
logout/save/old-401/new-attempt/deadline races and real loopback redirect blocking.
No source mutation experiment was performed because this ticket expressly forbids
source edits; independent adverse inputs supplied additional regression evidence.

Durable evidence directory:
`/Users/afe/orca/artifacts/ourhoomu/SW-0053-review/` contains `typecheck.log`,
`typecheck-e2e.log`, `format.log`, `unit.log`, `playwright.log`,
`playwright-results.json`, `negative-probes.ts`, and `negative-probes.log`.
The probe script embeds exact imports for this reviewed worktree; replay it with
`bun /Users/afe/orca/artifacts/ourhoomu/SW-0053-review/negative-probes.ts` while
that checkout exists. The committed assessment remains available after cleanup.

## Graft evidence and limits

🌱 Graft: **ACTIVE** — exact review worktree; CLI `0.21.1`. Initial `graft map`
refreshed 14 changed files after copying the main-checkout graph and returned
53 indexed files, 236 symbols and 615 edges. Follow-up source query,
DTO grep and `graft callers createApiClient --depth 2` returned relevant exact
checkout locations. Final `graft check` exited 0: wiring graph in sync, 289 nodes;
no deep meaning layer was built. Raw reads were for unindexed docs/config,
truncated implementation details, and exact contract comparison. Tool-reported
retrieval estimates total **201,945 tokens saved across four calls**
(140,466 + 8,399 + 39,734 + 13,346); these are tool estimates, not measured cost.

Browser/demo evidence verifies existing demo compatibility; fixture repository
responses verify the typed component. Workerd cases verify health, safe unknown
routes/CORS, preflight and hidden fixture routes. None proves domain handlers,
real identity, current server membership, DB isolation, live house/account flows,
native Google/Apple login, devices, providers or production behavior. Resource
properties inside page data are not fully runtime-validated by requestPage.
These are explicit scope limits, not newly introduced blockers.

Lead owns acceptance, integration, retained artifact capture, worker release and
worktree lifecycle. No required correction or unresolved review blocker remains.
