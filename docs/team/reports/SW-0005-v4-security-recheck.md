# SW-0005 corrected core API security recheck

TASK: Independent bounded recheck of corrected source
`77b7fb6ff758ab74bf3329c8ad16b426926d871c` against previous review `50796a8`.

STATUS: APPROVE the bounded core corrections. The three previous findings are
resolved in the committed correction.
No application authentication, authorization or DTO privacy blocker was found in
this bounded delta. One requested verification detail remains: the runtime check
accepts health status 201, rather than requiring exactly 200. Record that
low-severity verification gap for the Pi owner to correct during restricted
synthetic real-handler acceptance; it does not block that acceptance run.

Review/report workspace:
`/Users/afe/orca/workspaces/ourhoomu/v4-core-api-final-review`, branch
`codex/v4-core-api-final-review`, based exactly on `77b7fb6`. No application/test
source edits, DB calls, credential reads or provider calls. The active Pi source
checkout at the same committed SHA supplied installed dependencies for offline
commands; the isolated review checkout contains only this report change.

## Resolved findings

- Canonical account methods: `HttpTransaction` is now a required
  `Pick<CoreTransaction, ...>` including `accounts` and `account`; `dataAdapter`
  forwards the canonical callback directly. The mismatching runtime alias guard
  and optional account method contract are gone. Typecheck passes against the
  actual accepted data types. Redundant runtime presence checks for required
  `account` do not weaken the canonical type contract.
- Pagination: house/member/account handlers authenticate and validate cursor
  scope before reads, forward the decoded keyset cursor to canonical data
  methods, request up to `limit + 1` within the data layer's maximum 100, and
  probe one continuation row after the last ID when the returned page exactly
  fills a maximum-size request. There is no total-result cap of 20 or 100.
  Actor/path cursor MAC binding and explicit minimal DTO projections remain.
- Error status verification: runtime-check now requires exact 400 validation,
  401 unauthenticated and 404 hidden/unknown route statuses with matching codes.
  Nonempty request IDs and dedicated loopback URL/mode checks remain.

## Remaining P3 verification finding

`ourhoomu-api/scripts/runtime-check.ts:32` still checks `!response.ok` for
health, so 201/202/etc with the expected body pass. The requested acceptance
detail was exact health 200. Require `response.status === 200` for that branch.
This behavior predates the correction; it is not a new authorization regression.
An offline mock of global fetch returning health 201 and the expected 404/CORS
responses caused the actual committed runtime-check to print production checks
passed. No network connection was made.

## Verification and limits

- `git diff fd099e7 77b7fb6 -- ourhoomu-api/src/modules/core/runtime.ts ourhoomu-api/src/modules/core/data.ts ourhoomu-api/scripts/runtime-check.ts`:
  inspected corrected typed adapter, keyset logic and exact error checks.
- `graft ask 'pageCursor pageResult dataAdapter canonical accounts' --source -n 3`
  in the isolated review checkout succeeded, refreshed its graph, and reported
  estimated 6,318 tokens saved. Direct diff/source reads supplied missing spans.
- `cd ourhoomu-api && bun test tests/auth/core-data.test.ts tests/auth/core-http.test.ts tests/auth/secrets.test.ts tests/runtime.test.ts`:
  exit 0, **28 passed, 0 failed, 169 assertions**.
- `cd ourhoomu-api && bun run typecheck`: exit 0.
- Offline actual `CoreTransaction.houses` + actual `dataAdapter` + actual
  `coreDataHttp` exercise with 101 in-memory rows: first page 100 items and
  signed cursor; continuation one item and null cursor. Recorded canonical
  query calls were limit 100 without cursor, limit 1 after item 100, then limit
  100 after item 100. The fake select chain inspected the actual Drizzle cursor
  parameter and performed only in-memory filtering/slicing. No pool or client
  was instantiated and no SQL/network call was made.
- Offline actual runtime-check with mocked fetch: health 201 incorrectly passed
  (remaining P3 above).

This does not claim actual DB/HTTP, workerd, live issuer, native, provider or
release acceptance. Application account-secret AAD/privacy logic was unchanged
by this correction; explicit account DTO fields still exclude plaintext account
number, ciphertext, identifier digest and internal owner identity.

CHANGED_FILES: This report only.

ISSUES: Exact health 200 remains a check-only correction. Real restricted-role
HTTP acceptance is NOT VERIFIED by this review and stays with its exclusive Pi
owner. The separate bill-destination snapshot AAD seam is outside this core
correction and must not be inferred complete from this review.

NEXT_ACTION: Proceed with the restricted synthetic real-handler acceptance
window. Pi also tightens health equality during that task. Lead records final
source SHA and actual acceptance before integration/status updates. The
corrected core adapter/pagination/error source is approved for that acceptance
run; no full SW-0005 acceptance is implied.
