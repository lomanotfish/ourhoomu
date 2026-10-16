# SW-0005 independent core API delta review

## Task and review boundary

TASK: Independent read-only security/integration review of core API source
`fd099e7623b587e9e6ed2e20b0c6af5a12d9f87e`, against accepted data source
`244348c` and the accepted wire/privacy boundaries. Review workspace:
`/Users/afe/orca/workspaces/ourhoomu/v4-core-api-security-review`, branch
`codex/v4-core-api-security-review`, based exactly on `fd099e7`.

STATUS: Changes required before core HTTP integration acceptance. The observed
uncommitted runtime-check changes in the active Pi workspace were reviewed as a
separate dirty delta; they are not part of the frozen SHA above.

No application/test source edits, database calls, provider calls, deployment,
credential reads, or authoritative ticket/status changes were performed. Pi
retains the exclusive synthetic database window and implementation ownership.

## Findings

1. **P1 — Runtime projection names reject every authenticated data request.**
   `ourhoomu-api/src/modules/core/runtime.ts:10` requires `ownAccounts` and
   `ownAccount` on the actual `CoreTransaction`. The accepted data implementation
   provides `accounts` and `account` (`src/db/connection.ts:205`, `:211`), without
   those aliases. Consequently `dataAdapter(...).withPrincipal(...)` throws
   `feature_unavailable` before invoking any callback, including `/v1/me` and
   house operations. The actual HTTP acceptance server uses `createRuntimeApp`,
   so it is affected; HTTP tests with structurally matching fake transactions
   do not exercise this mismatch. Map canonical account methods explicitly in
   the application adapter and replace the unchecked structural assertion with
   compiler-checked forwarding. Preserve restricted-role transaction authority.

2. **P2 — HTTP pagination cannot reach rows after the first database page.**
   `src/modules/core/data.ts:156` and `:187` call `tx.houses()` and
   `tx.members(houseId)` without cursor/limit. Actual data methods default to 20
   rows (`src/db/connection.ts:168`, `:232`). HTTP `page()` then filters/slices that
   already truncated result; with 21 accessible houses and HTTP `limit=20`, the
   response contains 20 items and `nextCursor: null`. A client cursor after the
   twentieth item cannot recover the missing rows. Account listing has the same
   risk when implementing the mapping to canonical paginated `accounts()`.
   Forward a validated cursor/limit into the canonical data methods and determine
   continuation without treating an arbitrary default page as the complete set.
   Preserve actor/path MAC binding and DTO minimization. Add boundary coverage
   using the actual adapter surface, including lists longer than 20.

3. **P2 — Dirty runtime-check refactor weakens exact error-status verification.**
   Observed active-workspace `scripts/runtime-check.ts:37` checks only
   `response.status < 400` and the expected error code. The prior exact checks
   required validation 400, missing authentication 401, and unknown/hidden route
   404. The refactor would accept, for example, 500 with a `not_found` error body.
   Restore exact expected status equality in the helper and require health 200;
   retain the new explicit dedicated loopback URL, exclusive mode selection and
   nonempty request ID checks. This finding applies to the observed dirty delta,
   not `fd099e7`'s committed runtime-check script.

## Security observations within the reviewed scope

- The `fd099e7` exchange type-narrowing change preserves the two-phase
  proof-bound replay lookup and fresh issuer verification before initial
  exchange. Replay ciphertext AAD includes provider, challenge, client proof
  digest, idempotency digest and exact body hash. Returned tokens are checked
  through access-session verification, preserving revocation enforcement.
- Refresh replay AAD includes the original refresh digest and exact request
  evidence. No HTTP caller-supplied digest or principal is promoted to authority.
- Account identifier encryption binds purpose, key version, owner and keyed
  bank/identifier digest. Bank-only changes decrypt the owner-only secret and
  re-encrypt under the new digest; generic DTO construction explicitly selects
  public contract fields and omits plaintext, ciphertext and internal digests.
- Membership removal/leave uses owner-scoped canonical snapshots and supplies
  the observed version to the command. Successful HTTP responses use the
  command-bound membership DTO and omit global user/house identifiers.

These observations are bounded source/unit-test conclusions. They do not approve
the broken runtime adapter, replace DB-backed race/authorization acceptance, or
claim live Google/Apple/native/provider/release acceptance.

## Verification

Commands ran in the active source checkout read-only, with no database calls:

- `git rev-parse HEAD`: `fd099e7623b587e9e6ed2e20b0c6af5a12d9f87e`.
- `graft ask 'runtime authentication proof idempotency core data account ciphertext' --source -n 6`:
  succeeded; graph refreshed two changed files; reported estimated 8,226 tokens
  saved. Direct source reads followed for truncated spans and canonical adapter
  details missing from the retrieval.
- Offline `bun -e` reproduction importing actual `CoreTransaction` and
  `dataAdapter`, using `Object.create(CoreTransaction.prototype)` and an in-memory
  fake `withPrincipal` callback (no pool/client instantiated): observed
  `feature_unavailable`; `typeof ownAccounts/ownAccount` was `undefined`, while
  `typeof accounts/account` was `function`. The work callback was never invoked.
- Offline `bun -e` reproduction importing actual `CoreTransaction.houses` and
  `coreDataHttp`, with an in-memory fake Drizzle select chain containing 21
  synthetic rows and a `.limit(n)` implementation: `/v1/houses?limit=20` returned
  `{ availableRows: 21, returnedRows: 20, nextCursor: null }`. No SQL/network calls.
- `cd ourhoomu-api && bun test tests/auth/secrets.test.ts tests/auth/issuer.test.ts tests/auth/core-http.test.ts tests/auth/core-data.test.ts`:
  exit 0, **76 passed, 0 failed, 192 assertions**. This uses synthetic signatures
  and stubbed/in-memory persistence; it does not prove real adapter/DB parity.

CHANGED_FILES: This review report only.

ISSUES: Three findings above; current candidate cannot receive full core HTTP
acceptance. Actual HTTP/database acceptance is NOT VERIFIED by this review.

NEXT_ACTION: Lead routes the adapter/pagination/runtime-check corrections to Pi,
then freezes the corrected commit for focused re-review and records actual
restricted-role real-handler acceptance from the exclusive synthetic DB owner.
Only the Lead integrates and changes authoritative status.
