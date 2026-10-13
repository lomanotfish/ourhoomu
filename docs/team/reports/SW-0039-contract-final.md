# SW-0039 final focused contract review

Date: 2026-10-13. Reviewer: independent data-engineer. Frozen input: `aa36bf3ac91a36fa67a84ef4a93dd3171696896e`, OpenAPI `0.3.1-core-proposal`, 48 operations. Read immutable contract files through `git show`; no checkout or source changes. This review follows the [original report](SW-0039-contract-review.md), including its `115f879` recheck, and checks the route/schedule revision `a00c383` plus typed-error/aggregate revision `aa36bf3`.

## Verdict: changes_requested

F8 and F9 are resolved. The route-family matrix resolves most of F3, but one concrete authorization mapping gap remains before consumer contract acceptance. No additional blocking privacy or schedule-schema regression was found in this focused review. This is contract evidence, not runtime enforcement evidence.

## Blocking finding — F3: restricted reads omit the known-action denial policy

- **Location:** Frozen `docs/project/openapi.yaml:3067`, `paths["/v1/houses/{houseId}/bills/{billId}/recipient-accounts"].get.{x-permission,responses,x-error-policy}`; related private read at `docs/project/openapi.yaml:5007`, `paths["/v1/payments/{attemptId}/slip"].get`. Core rule: `docs/project/core-api-contract.md:30` and `:63`.
- **Concrete case:** B is a current active member, can read a non-expired same-house draft bill created by A, and calls its recipient-account selector using valid IDs. B is not the draft creator, so `x-permission: active draft creator only` denies the action. The core contract requires 403 `forbidden` for an active member's known in-scope forbidden action. However, this route has only 200/400/401/404/410/429, and its `x-error-policy.statuses` also omits 403. Returning the required 403 falls outside the advertised response matrix; returning 404 instead has no stated route-specific exception to the core rule.
- **Related case:** An active house owner who can read a payment summary, but is neither uploader nor recipient, cannot download its private slip. The slip route likewise omits 403 and uses the same general house-child policy. Its provider/storage gate correctly prevents execution now; the eventual permission-denial mapping still needs to be explicit. Hiding private-slip existence with 404 can be a valid policy, but that exception must be stated consistently rather than inferred from the generic out-of-scope description.
- **Required correction:** Add 403 `forbidden` and its status-policy entry for the selector's known in-scope creator denial. For slip reads, either use the same known-action 403 rule or explicitly define viewer-private scope as hidden 404 and reconcile the core rule accordingly. Preserve hidden 404 for inactive/removed members and cross-house IDs, and require live prior-access proof before 410. No private projection is needed in any denial.
- **Owner / next action:** Tech Lead routes this narrow contract correction to the SW-0036 owner, freezes a replacement SHA, and requests a focused denial-matrix recheck. Reviewer made no contract changes.

## Finding closure and focused checks

| Finding | Result at `aa36bf3` | Evidence |
|---|---|---|
| F1 | Closed; no regression observed | Bill list references closed `BillListItem`; no shares or full account destination. Detail retains live viewer visibility. |
| F2 | Closed; no regression observed | Required bill/payment/chore action flags, method-discriminated payment states, cash decision audit and chore completion state remain present. Dashboard totals retain viewer attribution. |
| F3 | Partially closed; blocking case above | All 48 operations have matching response/error-policy status lists. Public auth/profile/house collections no longer advertise household 403/404/410. House reads and mutations specify membership-first checks; invitation acceptance uses opaque 404 for invalid/expired/consumed/revoked tokens. Restricted GET denial cases remain incomplete. |
| F4 | Closed at contract level | Refresh locks credential family, permits exact credential/key/body retry for five minutes, revokes different reuse, and gives logout/revocation precedence. Typed rotate inputs retain handler-derived body hash. |
| F5 | Closed at contract level | Removed/inactive member receives hidden 404 before expiry evaluation; no retained DTO access. Tombstones remain parent capped. |
| F6 | Closed within retained gates | Scoped member IDs/tombstones and issued-versus-metadata invitation DTOs remain. Account deletion has no 2xx DTO and remains fail-closed 503. |
| F7 | Closed; instance tested | All 47 composed JSON 2xx schemas admit a synthesized required-field instance and reject an unknown envelope field. Binary slip and standalone webhook success are outside this count. |
| F8 | Closed; instance tested | `Error.oneOf` separates closed `VersionConflictError` and `OtherError`. Positive integer `currentVersion` is required only for `version_conflict`; all 16 expected-version operations describe live authorization, no inline resource, and refetch. |
| F9 | Closed; instance tested | All three dashboard totals are exact decimal strings, without an aggregate cap. Above-per-bill, above-JavaScript-safe-integer and 100-digit totals validate; numeric and noncanonical representations fail. Individual bill/payment amounts remain capped integers. |

`ChoreRule` admits repeat/rotation only, with daily/weekly intervals, required local start/anchor dates, optional end date, ordered unique assignees and Sunday=0 weekdays. Three legal daily/weekly/repeat instances pass; six invalid manual/weekday/repeat-cardinality cases fail. Date ordering and live assignee membership remain explicit server validation obligations rather than schema-enforced comparisons. Stable eligible-date rotation, removed-member slots, future-only revisions, 14-day preview, 30-day generation and occurrence uniqueness remain stated; no obvious regression was found. No schedule engine was executed.

Public projection checks rejected 16 private-field additions across `BillListItem`, masked `AccountPrivate`, cash/transfer summaries, activity, invitation metadata and member DTOs. Despite its name, `AccountPrivate` contains masked account metadata, not full bank identifiers. Full `RecipientPrivate` is limited by bill-detail viewer rules. Errors reject inline resources; actual viewer authorization still requires runtime tests.

## Validation evidence

- Exact workspace: `/Users/afe/orca/workspaces/ourhoomu/sw-0039-contract-review`; branch `witchagorn/sw-0039-contract-review`; starting HEAD `fad370284ccc5ab324ef9d2e68708dc4e7493525`. Review input was read by SHA, independent of checkout HEAD. Only this final report is owned/changed.
- `git show aa36bf3:docs/project/openapi.yaml > /tmp/sw0039-final.wi8Bel/openapi.json`; Python byte comparison against a fresh `git show` passed.
- Existing isolated `/tmp/sw0039-openapi-review-venv/bin/python`, `openapi-spec-validator 0.7.2`, `jsonschema 4.25.1`: `validate_spec` passed. `Draft202012Validator` with `FormatChecker` and local component references passed 47/47 composed success instances and rejected 47/47 unknown envelope fields. Samples resolve refs, select a union branch and synthesize required properties; this establishes schema satisfiability, not business-state validity.
- Version errors: valid typed version passed; missing/string/zero/fractional versions failed; other error with version failed; plain other error passed; inline resource failed. Dashboard: 12 positive and 21 negative aggregate cases passed their expected acceptance/rejection. Schedule: three positive and six negative cases passed their expected result. Public projections rejected all 16 private-field additions.
- All 48 error-policy status lists exactly match their advertised non-2xx responses; every gated operation has 503; every 429 has `Retry-After`. Mechanical consistency does not resolve the missing applicable 403 case above. General HTTP/code meanings remain declared in core prose; common `ErrorEnvelope` alone does not constrain a code to one HTTP status.
- Validation scripts ran in `/tmp/sw0039-final.wi8Bel/`; no repository dependency, lockfile, app, DB, provider or deployment changes. An existing urllib3/LibreSSL warning occurred during validator import; local validation completed with exit 0.
- `git diff --check`, report path/fence inspection and ownership checks passed before committing. The reproduction below was executed successfully using the frozen temporary document.

### Minimal reproducible F3/F8/F9 checks

After the frozen extraction above, run with the isolated Python validator environment:

```python
import json
from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import validate_spec

p = json.load(open('/tmp/sw0039-final.wi8Bel/openapi.json'))
validate_spec(p)
def valid(schema, instance):
    root = {'$ref': '#/response', 'response': schema,
            'components': p['components']}
    return not list(Draft202012Validator(
        root, format_checker=FormatChecker()).iter_errors(instance))

route = '/v1/houses/{houseId}/bills/{billId}/recipient-accounts'
op = p['paths'][route]['get']
assert op['x-permission'] == 'active draft creator only'
assert '403' not in op['responses']  # F3 residual matrix gap
assert '403' not in op['x-error-policy']['statuses']

error_schema = {'$ref': '#/components/schemas/ErrorEnvelope'}
error = {'error': {'code': 'version_conflict', 'message': 'Changed',
                   'currentVersion': 2},
         'requestId': '550e8400-e29b-41d4-a716-446655440001'}
assert valid(error_schema, error)
error['error']['code'] = 'idempotency_conflict'
assert not valid(error_schema, error)  # no version on other codes
del error['error']['currentVersion']
assert valid(error_schema, error)

dashboard = {'asOf': '2026-10-13T00:00:00Z', 'pendingPayments': [],
             'todayChores': [], 'cashAwaitingDecisionCount': 0,
             'outstandingSatang': '1350000000000',
             'owedToMeSatang': '9007199254740993',
             'pendingSatang': '9' * 100}
dashboard_schema = {'$ref': '#/components/schemas/Dashboard'}
assert valid(dashboard_schema, dashboard)
dashboard['outstandingSatang'] = 1350000000000
assert not valid(dashboard_schema, dashboard)
print('F3 residual confirmed; F8/F9 reproduction passed')
```

## Runtime/Graft and retained gates

**Graft: ACTIVE** in the exact review worktree. `graft --version` returned `0.21.1`; `graft map` exited 0 and returned 26 supported JS/TS files, 84 symbols and 293 edges. Contract Markdown/YAML is outside that indexed scope; immutable `git show` reads are the stated fallback. One retrieval reported estimated orientation savings of 29,825 tokens; no measured contract-review savings are claimed. No source edits occurred after that checkpoint, and report completion retains the same scope/status evidence.

Effective permissions are evidenced by this dispatch's harness instructions: `approval_policy=never`, `sandbox_mode=danger-full-access`. Full tool access does not expand reviewer ownership. No nested agents or user questions were opened; coordination uses the actual Orca dispatch.

Native Google/Apple issuer/session proof, SlipOK recipient matching/reference precision/retention, private-storage enforcement, LINE destination/binding/credentials, account-deletion workflow and backup/external-copy purge remain separate acceptance gates. No DB/runtime API/native/provider/deployment success is asserted. Ticket/board/checklist acceptance, integration and cleanup belong to the Tech Lead.
