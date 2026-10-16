# SW-0063 private destination AAD security review

Review date: 2026-10-16 UTC. Reviewer: native Security Engineer. Assignment: independent review of `dfb7e6eaa67dc327e3dce87f77c2e945d7d930a3`, followed by owner test-only corrections. No application, test or migration fixes authored by this reviewer. The Lead exclusively authorized this disposable synthetic DB window; no production, reset, provider or deployment action occurred.

## Scope and source assessment

The migration changes only the body of `core.private_destination(uuid,uuid)`. Its exact accepted predecessor body hash is `be739ebd7a4adb72e2a66bad4490dbc9`; the replacement is `ec26048eea809fd890d618ba42864213`. Static assertions compare the complete replacement with the accepted 0001 body plus the two frozen AAD fields. The existing membership, hidden missing-resource, live bill, recipient/currently owing payer and live snapshot predicates remain intact.

`ownerUserId` comes from the published snapshot's `recipient_user_id`; `identifierDigest` comes from that same snapshot. Publishing already selects the account with `owner_user_id=b.recipient_user_id` and copies both identity and digest into that snapshot. The change never consults a subsequently mutable account for AAD. Both added TypeScript properties are on the internal `EncryptedDestination` type. No public wire contract or DTO source was changed. The restricted test proves authorized recipients and owing payers can obtain the frozen values, non-owing members and other-house actors cannot, and public bill lists contain neither field. This is synthetic projection evidence; actual cryptographic account decryption and complete HTTP serialization acceptance belong to downstream integration.

Accepted migrations 0000–0003 are unchanged against both `dfb7e6e^` and the recovered Lead baseline `47e34cc`. Metadata checks confirm 0004 is function-only and snapshot schema content equals 0003. No tables, roles, grants or indexes are added by 0004.

## Guarded lifecycle evidence

Recovered common Git directory: `/Users/afe/Desktop/ourhoomu/.git`. Assigned worktree was clean at `dfb7e6e`. Initial read-only inspection observed the exact accepted old body, OID `61299`, owner `ourhoomu_core_writer`, `SECURITY DEFINER`, UUID/UUID arguments, JSONB result, PL/pgSQL, and `search_path=pg_catalog`. ACL was exactly writer/app EXECUTE; no PUBLIC grant. `runtime_probe` existed and there were 300 existing synthetic bills. No competing DB or Pi processes were observed before mutation.

All DB commands used `loadTarget()` with these explicit paths:

```sh
SYNTHETIC_DB_ENV_FILE=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env
NEON_BRANCH_RECEIPT=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json
```

The loader passed the mode600 guard, exact project/branch/endpoint/receipt/expiry checks, direct owner endpoint and app/auth role URL checks. No credential values were printed. Shell environment assignments were applied to each command, not sourced from root env.

A temporary reviewer audit harness at `/tmp/ourhoomu-aad-security-review.ts` (SHA256 `ba4b37ec8267ac35948f8bdc607cada02f18a9d164483842a9a3b38dbadc5e2f`) executed the checked-in up/down SQL directly through the guarded owner pool. The migration SQL SHA256 was `636145bdbe24d16f8f674d8e0e96e264262d94eaeda6dc4117e59eca1549294b`.

Passed, exit 0:

- Recognized predecessor rollback is a no-op.
- Apply changes exact old body to exact new body; reapply is a no-op.
- Rollback restores the complete exact old body; final reapply restores the new body.
- Both apply and rollback reject an unknown body (transaction-only comment mutation) and reject `SECURITY INVOKER` tampering. Each tampering transaction was rolled back, then baseline identity rechecked.
- Every lifecycle step preserves function OID, owner, ACL, language, argument/result signature, security mode and configuration. A digest of every other core function's source/security/catalog values and all core table row counts also remains unchanged. `runtime_probe` remains present.

Final AAD state after lifecycle and targeted acceptance: OID `61299`, body MD5 `ec26048eea809fd890d618ba42864213`, owner writer, exact original writer/app ACL, `SECURITY DEFINER`, pinned search path and UUID/UUID → JSONB. Reviewer pool closure was explicitly awaited. Synthetic test fixtures created by acceptance suites remain; no reset or destructive cleanup was performed.

## Commands and actual outcomes

Working directory for Bun commands: `ourhoomu-api/` in the assigned worktree. Guarded DB commands used the environment above.

- `bun scripts/db/check-private-destination-aad-migration.ts`: PASS.
- `bunx drizzle-kit check`: PASS, "Everything's fine".
- Lifecycle harness command `bun /tmp/ourhoomu-aad-security-review.ts`: PASS, pool closed.
- `bun scripts/db/check-http-schema.ts`: PASS all four groups, including canonical HTTP seam metadata, FORCE RLS/runtime denial and locator retention constraints.
- `bun scripts/db/check-read-parity.ts` at original `dfb7e6e`: FAIL at new expired-parent assertion. Actual `expired` matches unchanged `core.require_live`; new assertion incorrectly expected `not_found`. The new authorized/frozen AAD group passed first.
- Lead advanced reviewer to owner correction `ea435c1` (equivalent to `20ae005`), changing only that assertion. Rerun: PASS all eight groups, exit 0. Output: `/tmp/ourhoomu-aad-parity-ea435c1.log`.
- `bun scripts/db/check.ts` at `dfb7e6e`/`ea435c1`: FAIL stale whole-dashboard comparison against the old three-key shape; financial scalar values match. Two executions occurred before expanded output exposed this old assertion. The actual restricted-role, two-house RLS, invalid share atomicity and published self-covering groups passed first.
- Lead-authorized owner correction `d193bec` was cherry-picked as `aededfd`. Rerun `check.ts`: FAIL its new count assertion (expects 1 but payer B sees 0). Cash decision count belongs to bill creator A. This is reported to the owner; no assertion was weakened by the reviewer.
- Final read-only catalog assertions: PASS 23/23 tables have enabled and forced RLS; every core function is writer-owned with pinned search path and no PUBLIC EXECUTE; all three restricted roles have no superuser/BYPASSRLS/create-role/create-db privileges and writer is NOLOGIN; AAD identity and `runtime_probe` preserved. Pool closed.
- `git diff --check`: PASS before report completion.

## Remaining verification

The targeted AAD source/lifecycle/authorization checks pass after the expired-expectation correction. **Approve the bounded 0004 AAD change with that correction.** No blocking security defect was found in this change. This is not approval of the complete core HTTP product or the general legacy invariant suite.

Owner correction `8d36fe3` was subsequently cherry-picked with Lead authorization as `c5733bfdcfd095f13eb8e839f80967ba3ae5bbb4`: payer B count 0 and creator A count 1. `bun scripts/db/check.ts` was rerun at that SHA and progressed past both assertions. It then FAILED the second stale whole-dashboard comparison at line 289 (actual financial values 6000/0/0 match; expanded `asOf`, count 0, empty pending payments and today chores are additional properties). Output: `/tmp/ourhoomu-aad-invariants-corrected.log`. The owner was asked to inspect all remaining old comparisons before further runs. No full legacy invariant-suite pass is claimed, and later tests in that suite remain NOT VERIFIED.

Final guarded read at `c5733bf` passed the exact new AAD identity, owner/ACL/config/security and runtime-probe assertions. All reviewer, restricted app/auth and owner pools were awaited closed. The exclusive DB window was explicitly released to the Lead after the final requested read-only catalog capture. Existing and newly created synthetic fixtures remain; no schema reset, production connection or provider action occurred.

At the Lead's request, the actual complete `core.bill_detail(uuid,uuid)` source, `pg_get_functiondef`, signature/security/owner/ACL and OID were captured to private mode600 common-Git evidence file `/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/aad-review-bill-detail-catalog-20261016.json`. OID `61303`; source MD5 `161704d41ad0681f0333a82508718a49`; definition SHA256 `b50a2d8d73987c3898d077b4468a74da4b4b4148be7e7573d1f6020dc9b8f22b`. No function was modified by this capture. This evidence contains SQL definitions and metadata, no credentials.

Graft: `graft grep 'private_destination'` succeeded, estimated 10,615 tokens saved. SQL migrations were outside the indexed source results, so direct SQL/source diff inspection was used for exact body and grant review.
