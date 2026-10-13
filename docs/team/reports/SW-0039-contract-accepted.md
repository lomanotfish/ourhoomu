# SW-0039 final contract acceptance recheck

Date: 2026-10-14 (Asia/Bangkok). Reviewer: independent data-engineer. Frozen input: `7756bcc2a98a902c3ccfddb365ae953a0992b66d`, OpenAPI `0.3.2-core-proposal`, 48 operations. The exact task narrows the ticket to the remaining F3 restricted-GET correction (`7756bcc`) and unsaved preview DTO (`6b0c6c8e0c35c00d6aa936fa5a7287c99a033476`). Input was read immutably with `git show`; checkout HEAD remained `30ca8bd01d9796c719cbc6528bdd0bc361a37b4d` before this report commit.

## Verdict: approve

The remaining F3 gap is closed and the new preview DTO meets the stated consumer contract. No concrete blocking issue was found in these two changes. This completes the focused data contract recheck; acceptance, integration and ticket status belong to the Tech Lead. Runtime authorization, schedule computation and provider enforcement are not proved by document validation.

Prior F1–F9 evidence remains in the [original review](SW-0039-contract-review.md) and [final review](SW-0039-contract-final.md), reviewed at `aa36bf3ac91a36fa67a84ef4a93dd3171696896e` and recorded by report commit `30ca8bd`. Those checks were not rerun or broadened here. The immutable OpenAPI/core-contract diff from `aa36bf3` to the frozen input contains the two assigned changes and version bump.

## Restricted GET closure

| Frozen location | Recheck result |
|---|---|
| `docs/project/openapi.yaml:3069`, `paths["/v1/houses/{houseId}/bills/{billId}/recipient-accounts"].get` | `x-permission` remains active draft creator only. A current member who knows an in-scope draft but is not its creator receives 403 `forbidden`, without a private projection. Both `responses` and `x-error-policy.statuses` now contain 403; `restrictedRead` at line 3221 makes the mapping explicit. |
| `docs/project/openapi.yaml:5021`, `paths["/v1/payments/{attemptId}/slip"].get` | Current active membership AND uploader-or-recipient identity remain required; creator/owner gets no override. A known in-scope nonviewer receives 403 `forbidden`, with no bytes/private projection. Both response/policy lists include 403; `restrictedRead` at line 5168 states the mapping. The private-storage runtime gate and fail-closed 503 remain. |
| Both routes, `x-error-policy.evaluationOrder`, `responses["404"]`, `responses["410"]` | Credential then active membership precedes child lookup/expiry. Removed/inactive members and cross-house/out-of-scope IDs remain hidden 404 before and after expiry. 410 requires current live parent access and prior child-access proof capped by parent retention; it is never used to reveal existence to a removed member or cross-house caller. |

This agrees with `docs/project/core-api-contract.md:28–30`, the uploader/recipient boundary at line 53 and error-code meanings at line 65. Both routes' non-2xx response keys exactly match their policy status lists. Each route's 403/404/410 error schema accepts the corresponding `forbidden`/`not_found`/`expired` envelope and rejects an inline private resource: **6 positive and 6 negative checks passed**. Shared `ErrorEnvelope` does not independently bind a code to an HTTP status; that remains specified by route/core semantics, as recorded in the prior review.

## Unsaved preview DTO

- `docs/project/openapi.yaml:5455`, `previewChoreSchedule.responses["200"]` now composes `SuccessEnvelope` with `ChoreSchedulePreview` (reference at line 5502), rather than a persisted `Chore`. The request remains `ChoreRule`.
- `components.schemas.ChoreSchedulePreview` at line 9769 requires household `timezone` and `occurrences`, permits an empty array, caps it at 14 rows and closes extra properties. `ChorePreviewOccurrence` at line 9740 requires a calendar `localDate` and UUID-or-null `assigneeMembershipId`; null explicitly represents unresolved assignment. Its extra properties are also closed.
- Operation description at line 5596 and `docs/project/core-api-contract.md:63` specify matching dates from submitted `startDate` through `startDate + 13` inclusive, capped by inclusive `endDate`. This is a 14-calendar-day window, not the next 14 matches of a sparse weekly rule. The existing house-local rule, stable eligible-date rotation and membership validation obligations remain applicable.
- The response has no persisted occurrence/schedule ID, version or expiry. Adding `id`, `scheduleId`, `version` or `expiresAt` to either a row or the preview object fails validation. A `nextCursor` on the success envelope also fails. Operation/core prose explicitly requires no writes or version transitions.

**5 valid response samples passed:** one assigned row; no matching rows; unresolved/null assignee; 14 daily rows crossing October into November; and a three-row end-date-capped window. **17 invalid samples were rejected:** missing timezone/occurrences/date/assignee; 15 rows; impossible date; timestamp instead of date; malformed membership UUID; eight persisted-field additions; and cursor leakage.

The schema validates date format and row count, but cannot compare response dates with the submitted request's window/end date or establish current membership/timezone authority. An otherwise well-shaped 2030 date passes schema validation; the documented server rule must reject it for a 2026 window. These are explicit implementation obligations, not a claimed schedule-engine result or a new contract blocker. No schedule engine or write behavior was executed.

## Validation evidence and reproduction

- Exact worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0039-contract-review`; branch `witchagorn/sw-0039-contract-review`; clean starting worktree. Only this report is owned and changed.
- Extracted frozen bytes using Python `subprocess.check_output(['git','show',sha+':docs/project/openapi.yaml'])`; a second extraction was byte-identical. SHA-256: `ad02a058a7ffa7a637463d7b02e5820481103abfe4ee19c7851fee79d0d0ca4f`.
- Existing isolated `/tmp/sw0039-openapi-review-venv/bin/python`; `openapi-spec-validator 0.7.2` and `jsonschema 4.25.1`. `validate_spec` passed the frozen document. Instance checks used `Draft202012Validator`, `FormatChecker` and local component references. Focused script `/tmp/sw0039-accepted-recheck/check.py` exited 0 with `All focused checks PASS`; temporary extraction is `/tmp/sw0039-accepted-recheck/openapi.json`. No repository dependency/config/lockfile changes. Import emitted the existing urllib3/LibreSSL warning; local validation completed successfully.
- Reviewed Markdown structure, prior-report relative links and exact frozen line locations; `git diff --check` and report-only ownership checks passed before committing. No application build or DB test is required for this documentation-only result.

Minimal independent reproduction, using the same isolated Python environment from the repository worktree:

```python
import copy, json, subprocess
from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import validate_spec

p = json.loads(subprocess.check_output([
    'git', 'show', '7756bcc:docs/project/openapi.yaml']))
validate_spec(p)
routes = ['/v1/houses/{houseId}/bills/{billId}/recipient-accounts',
          '/v1/payments/{attemptId}/slip']
for path in routes:
    op = p['paths'][path]['get']
    assert {'403', '404', '410'} <= op['responses'].keys()
    assert sorted(op['x-error-policy']['statuses']) == sorted(
        status for status in op['responses'] if not status.startswith('2'))
    assert 'returns403 forbidden' in op['x-error-policy']['restrictedRead']

op = p['paths']['/v1/houses/{houseId}/chore-schedules/preview']['post']
schema = op['responses']['200']['content']['application/json']['schema']
root = {'$ref': '#/response', 'response': schema,
        'components': p['components']}
v = Draft202012Validator(root, format_checker=FormatChecker())
sample = {'requestId': '550e8400-e29b-41d4-a716-446655440001',
          'data': {'timezone': 'Asia/Bangkok', 'occurrences': [
              {'localDate': '2026-10-20', 'assigneeMembershipId': None}]}}
assert v.is_valid(sample)
bad = copy.deepcopy(sample)
bad['data']['occurrences'][0]['id'] = sample['requestId']
assert not v.is_valid(bad)
sample['data']['occurrences'] = []
assert v.is_valid(sample)
print('Restricted GET matrix and unsaved preview checks passed')
```

## Graft/runtime and handoff

**Graft: ACTIVE** — exact assigned worktree; `graft --version` returned `0.21.1`; `graft map` exited 0 with 26 indexed files, 84 symbols and 293 edges. Markdown/YAML contract documents are outside that JS/TS index, so immutable `git show` is the explicit fallback. One map call reported estimated orientation savings of 29,825 tokens; no measured contract-review savings are claimed. No indexed source changed, so this status applies at review completion.

Runtime permissions are evidenced by this dispatch's harness settings: `approval_policy=never`, `sandbox_mode=danger-full-access`; no launch-argv claim is made. Read AGENTS, ticket, requirements/board, agent guide, approved core scope, domain/API rules, Graft skill and `software-tech-lead/references/agent-runtime.md`. No nested agents, user questions, source edits, DB writes, secrets, production/provider operations, deployment or push. Other work is preserved; board/checklist/status and integration/cleanup remain Lead-owned. The actual task/dispatch are `task_fb317f6c40a1` / `ctx_5a48464fe521`.

Native identity, SlipOK/LINE, private storage, deletion/retention and release gates retain their existing scope. Next action: Lead consumes this approve report with the prior evidence and decides contract acceptance/integration; implementation tickets must supply their own runtime proofs.
