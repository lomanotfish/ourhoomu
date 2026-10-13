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

The reviewer identified that `listBills` returned full `Bill`, allowing a private bank destination and all shares in list rows. Lead added closed `BillListItem` with aggregates and masked account metadata only, and changed the list route to that schema. A Draft 2020-12 sample list response passed, while the same row with `recipientAccountPrivate` failed. Confirmed domain statuses are now `draft/open/settled/voided`; `dueDate` is required on bill creation/output and optional on draft patch. Optional emoji is persisted for the existing bill/chore visual presentation. `openapi-spec-validator 0.7.2`, pinned `openapi-typescript 7.13.0` generation and `git diff --check` pass. Permission/action DTOs, payment state distinctions, refresh semantics and authorization status mapping still block final freeze.
