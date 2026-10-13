# SW-0036 contract proposal — worker report

Run `run_a401e29c745e`, task `task_85c15c82aef1`, dispatch `ctx_ac55c04f8d6d`; worktree `/Users/afe/orca/workspaces/ourhoomu/sw-0036-contract`, branch `witchagorn/sw-0036-contract`. Target baseline `b02e4719ec0319f522539d8886b65d29c7a5c613`; observed starting HEAD `c338db1ecbddd44cc41d2aaa335040e86c26c5c2` (activation atop target baseline). This report covers a documentation proposal only, before Lead acceptance.

## Deliverables

- `docs/project/openapi.yaml`: JSON syntax valid as OpenAPI 3.1 YAML; 39 paths, **48 operations**, 47 schemas. Every logical route in `api-contract.md` has an operation ID, permission statement, request schema where needed, success/error envelopes, error statuses, and explicit `x-status`. List routes have cursor/limit 20/100; risk-bearing mutation routes have idempotency key and version rules. LINE callback has raw-signature boundary. Gated issuer, SlipOK, private storage and LINE routes carry 503; their 200/202 schemas describe possible future states, not presently available runtime behavior.
- `docs/project/core-api-contract.md`: small verified issuer-subject principal/session interface and request-scoped transaction operation signatures, lock order, bill/cash/chore privacy and error decisions. No client-supplied actor or unsafe session `SET` authority. Native issuer/provider proof is retained as a gate.
- Examples use syntactically valid UUIDs. Money is integer satang with maximum 900,000,000,000, bps is integer 1–10,000 with publish sum exactly 10,000, chores use date-only household dates, and retention/lease/window values match `core-implementation.md`.

## Checks and evidence

- `graft --version` → `0.21.1`; `graft build --no-gitignore --no-ignore` and `graft map` in this exact worktree → 26 indexed JS/TS files, 110 nodes, 293 edges. **Graft: ACTIVE** for code; Markdown/YAML docs are not indexed, so raw document reads were used. `graft map` reported approximately 29,825 tokens saved (one retrieval call); no other savings claimed. Local `graft/` cache is excluded from tracked diff.
- Python `json.load` plus recursive local checks of all `$ref`, all UUID examples, all object required-property names, all path parameter declarations, unique operation IDs and operation permission/status metadata → 39 paths, 48 operations, 47 schemas, zero errors. This is structural validation, not a full OpenAPI semantic validator; none is installed locally (`jsonschema`, PyYAML, `openapi_spec_validator` absent).
- `git diff --check` → exit 0. No app handler, DB runtime, native device, real issuer, SlipOK or LINE test occurred in this documentation task.

## Review gates and next action

Lead should obtain independent data/security and frontend review before freezing DTOs. In particular, reviewers should check bill/account view projections and whether the generic bill list must use an even narrower schema, review account deletion and LINE callback status, and agree exact error codes before handlers consume this revision. Native Apple/Google credentials and proof, SlipOK reference/recipient/retention evidence, LINE destination/binding/credentials, external copy deletion and replay-floor precision remain gated. No production database, user dev branch, external provider or deployment was touched. Lead owns contract acceptance and integration; this worker does not change ticket, board or checklist status.

## Lead response-schema correction — 2026-10-13

Independent consumer review found all 48 success response compositions were unsatisfiable for the normal envelope: each `allOf` extension used `additionalProperties: false`, which rejected `requestId` and `nextCursor` declared by the base envelope. Lead removed the inner closed-object constraints and applied outer `unevaluatedProperties: false` to those 48 operation responses. Isolated `jsonschema` Draft 2020-12 validation now accepts a `GET /v1/houses` `{data:[],nextCursor:null,requestId:<uuid>}` response and rejects the same instance with an extra `secret` field. `openapi-spec-validator 0.7.2` reports `docs/project/openapi.yaml: OK`; pinned `openapi-typescript 7.13.0` generates a temporary DTO; and `git diff --check` passes. This resolves only the response composition defect; the remaining data/security/frontend review findings still block contract acceptance.

## Lead bill projection and UI field correction — 2026-10-13

The reviewer identified that `listBills` returned full `Bill`, allowing a private bank destination and all shares in list rows. Lead added closed `BillListItem` with aggregates and masked account metadata only, and changed the list route to that schema. A Draft 2020-12 sample list response passed, while the same row with `recipientAccountPrivate` failed. Confirmed domain statuses are now `draft/open/settled/voided`; `dueDate` is required on bill creation/output and optional on draft patch. Optional emoji is persisted for the existing bill/chore visual presentation. `openapi-spec-validator 0.7.2`, pinned `openapi-typescript 7.13.0` generation and `git diff --check` pass. At this checkpoint, permission/action DTOs, payment state distinctions, refresh semantics and authorization status mapping still blocked final freeze.

## Lead state/action DTO correction — 2026-10-13

The next narrow revision adds viewer-specific `BillActions`, `PaymentActions` and `ChoreActions`; method-discriminated cash/transfer payment summaries with distinct waiting states and safe decision/rejection metadata; chore completion/assignment fields; and attributed dashboard totals. `ErrorCode` is a closed core machine-code union for typed frontend branching. `openapi-spec-validator 0.7.2` and `openapi-typescript 7.13.0` pass; generated `PaymentSummary` is a TypeScript union of cash and transfer shapes, and `git diff --check` passes. Route-specific 401/403/404/410 mapping, exact refresh rotation retry semantics, membership removal/expiry privacy and invite/deletion workflow still block final acceptance.

## Lead refresh race correction — 2026-10-13

The public refresh route now advertises only applicable 400/401/409/429/503 outcomes. Its contract defines a five-minute exact replay result keyed by old credential digest, idempotency key and body hash; a serialized same-key retry gets the same pair while the family is active. Different reuse or replay after the window revokes the family with opaque 401, and logout wins over replay. Token digests and encrypted bounded replay storage are required. This is a contract decision, not issuer/session runtime proof. Remaining route authorization/privacy and invitation/deletion behavior still need review.

## Lead membership and invitation privacy correction — 2026-10-13

House-scoped `Member` no longer exposes global `userId`, and now carries a version plus optional removal timestamp. Leave/remove returns a tombstone only in its authorized mutation response; subsequent reads check active membership first and hide the house/child with 404 even after expiry. Active members may get 410 only for a child formerly accessible to them before its parent cap. Invitation create now returns `InvitationIssued` with a one-time token; revoke returns token-free `InvitationMetadata`. Accept maps invalid/expired/consumed/revoked tokens to the same opaque 404 `invite_unavailable`. These are transport/privacy rules, not runtime enforcement proof. Account deletion and remaining route-specific status matrix still block freeze.

`DELETE /v1/me` previously advertised a 200 `Me` payload that could not represent deletion progress. Its success response is removed; the operation remains fail-closed 503 `feature_unavailable` until a separate account deletion workflow and external-copy retention proof are accepted. No deletion behavior is claimed. Route-specific house/payment/chore status mapping remains under review.
