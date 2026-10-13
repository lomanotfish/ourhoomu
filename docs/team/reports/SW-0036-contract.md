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
