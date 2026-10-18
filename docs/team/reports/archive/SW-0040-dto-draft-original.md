# SW-0040 frontend wire DTO review

## Provenance

- Worktree: `sw-0040-front-dto`; starting HEAD `780bbd1e3855ca013a3c97fa78582cbe11b68f2a` (accepted baseline `b02e4719ec0319f522539d8886b65d29c7a5c613` plus contract activation).
- Frozen input: `docs/project/openapi.yaml` from `0c88553` (`git show 0c88553:docs/project/openapi.yaml | shasum -a 256` and working file both `07f8e0e91e1ae85ff54e69ad729f38d31e042b03f54820dd89ff1899ac54201d`). JSON-formatted OpenAPI 3.1 source despite `.yaml` extension.
- Tool: `openapi-typescript` 7.13.0, pinned isolated npm execution, checked with `npm exec --yes --package=openapi-typescript@7.13.0 -- openapi-typescript --version`. Official [CLI documentation](https://openapi-ts.dev/cli) documents local input and `-o`; [npm package](https://www.npmjs.com/package/openapi-typescript) records the pinned release.
- Generation: from repository root, `npm exec --yes --package=openapi-typescript@7.13.0 -- openapi-typescript docs/project/openapi.yaml -o ourhoomu-front/src/api/dto.ts`, then from `ourhoomu-front`, `bunx prettier --write src/api/dto.ts src/api/types.ts`. `dto.ts` is generated and only formatter transformed; `types.ts` has small schema/operation aliases. No package or lockfile change.

## Demo operation mapping and contract seam

| Current local demo action/read | Proposed wire operation(s) | Seam to settle before integration |
|---|---|---|
| Enter, switch, create, join, rename house | `getMe`, `listHouses`, `getHouse`, `createHouse`, `acceptInvitation`, `patchHouse`, `listMembers` | Demo entry has no verified session; invite code presentation/creation must use owner `createInvitation`, with one-time/expiry UX. `patchHouse` is owner-only. |
| List/create bill, choose recipient, split | `listBills`, `createBill`, `listEligibleAccounts`, `publishBill`, `getBill` | Demo's single create action must become draft, account selection, publish; server computes shares. Demo `dueDate` and `emoji` are absent in `BillCreate` and `Bill`; no persisted mapping exists. Clarify whether they are local decoration or contract fields before live UI wiring. |
| Request/cancel payment | `createPayment`, `cancelPayment`, `listPayments`, cash `confirmCash`/`rejectCash`; transfer `createSlipUpload`/`verifySlip`/`reconcilePayment` | Demo `transfer_demo` and two pending states do not represent server `transfer` plus pending, pending_verification, confirmed, rejected, cancelled, needs_attention. Creator confirmation and private slip access are separate permissions; do not infer success from request. |
| Create/preview/complete chores | `createChore`, `createChoreSchedule`, `previewChoreSchedule`, `listChores`, `completeChore`, `reopenChore` | Demo repeat/rotation date expansion is local. Wire `localDate` is house-local `YYYY-MM-DD`; `createdAt`/`expiresAt` are UTC date-time strings. `emoji` is absent in chore DTOs; decide local decoration versus persisted field. |
| Overview/activity | `getDashboard`, `listActivity`, `readActivity` | Dashboard is server as-of aggregate. Demo activity `text`/`emoji` maps only to contract `summary`/`kind` plus local presentation mapping; read cursor replaces local-only state. |

Wire statuses are string unions where defined; `ErrorEnvelope` is `{error: {code: string, message: string, fields?: Record<string,string>}, requestId: string}`. The error code remains an open string, so typed UI branches for validation/conflict/auth/expiry need a frozen code set from the contract owner. All operation errors are represented as HTTP response variants in `operations`; the integration layer must select response status and handle transport failures separately. No runtime API, native auth, provider, or permission checks were performed by this type-only slice.

## Proposed contract-owner decisions via Lead

1. Confirm whether bill `dueDate` and bill/chore `emoji` are intentionally presentation-only. If persisted product fields are required, amend the OpenAPI input and regenerate; do not manufacture DTO fields here.
2. Freeze machine-readable error codes and their status mapping for UI branches, especially 401/403, validation 400, missing/expired 404/410, and stale version 409. `Error.code: string` currently cannot enforce exhaustive handling.
3. Confirm how display metadata for activity and house subtitle/invite code should be derived or returned. The demo shapes cannot be cast to wire DTOs as-is.
4. Keep permission checks on the server: owner-only invitation/house rename, creator-only publish/cash confirmation, payer-only payment, private slip viewer. OpenAPI `x-permission` descriptions are not emitted as static TypeScript restrictions.

## Checks and limits

- `bun install --frozen-lockfile`: passed, 575 packages; did not change lockfile.
- `bun run typecheck`: passed after install. First attempt failed with `tsc: command not found` because dependencies were absent.
- `bun run format:check`: passed; `git diff --check`: passed.
- Generated DTOs prove the proposal is consumable by TypeScript. They do not prove server implementation, native login, provider behavior, or runtime integration.
- Graft 0.21.1 in this exact worktree: `graft build --no-gitignore --no-ignore` succeeded (26 indexed files, 110 nodes, 293 edges); `graft map` and `graft grep 'Demo' --in ourhoomu-front/src/demo` succeeded. **Graft: ACTIVE** for frontend source. Those two retrievals reported approximately 29,825 and 3,560 tokens saved, total approximately 33,385 across 2 calls. OpenAPI and Markdown are not indexed; read raw files for those.
