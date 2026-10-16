# SW-0063 bill actions and reservations security review

Date: 2026-10-16 UTC. Reviewer: native Security Engineer. Exact source reviewed and tested: `00fff17840508d6511f4076fbfdaf78211a01a9a`. Isolated worktree: `/Users/afe/orca/workspaces/ourhoomu/v4-bill-actions-review`. Reviewer authors this report only; no source, test or migration corrections were made.

## Decision

**Approve the bounded bill-only 0005 change.** No blocking security finding in the reviewed delta. The checked-in synthetic acceptance suite passes without corrections. This approval covers bill action/read projections and share reservation totals; it does not accept future cash/chore feature changes, production deployment, providers or native/release flows.

## Source assessment

`0005_bill_detail_actions.sql` changes only `core.bill_detail(uuid,uuid)`. It retains the reader/membership boundary, missing-resource handling, live parent requirement and the existing guarded private-destination lookup. It adds the five action flags and a `reserved_satang` share projection. Reservations include only unreleased attempts whose reservation, attempt and parent are live at a shared statement timestamp. `remaining_satang` continues to mean gross amount less confirmed credit, independently of reservations; draft amounts and remaining values stay null. Arithmetic remains in Postgres numeric/bigint and is returned as text for share values.

The list projection's `canPublish` deliberately calls the existing `core.account_selector(house,bill)` inside a creator-and-draft CASE. It does not read another user's account table through the app role or broaden grants. The definer detail function uses the corresponding active recipient/account and participant checks. Runtime acceptance uses a draft created by A with recipient B and B's account, so its detail action is true despite different account ownership. Existing creator, published, non-owing member and cross-house reads continue to pass. New flags are read affordances; command authorization, locking and version checks remain authoritative.

All five flags are on the internal bill projections/types. The detail function still obtains private encrypted account data through the previously accepted restricted function. No account ciphertext/digest is added to bill list items, and the existing no-private-fields recursive assertions continue to pass.

Accepted migrations 0000–0004 are byte-identical against review baseline `5453ded`; no table, role, grant or index change is introduced by 0005. The new Drizzle snapshot differs only in snapshot identity/chain metadata, with the same schema content as 0004. The function guards require exact predecessor/new source hashes, UUID/UUID → JSONB PL/pgSQL SECURITY DEFINER identity, pinned search path, accepted writer owner and exact writer/app EXECUTE ACL. Unknown state fails closed.

## Guarded database window and actual lifecycle

The Lead granted this reviewer exclusive use of the existing disposable synthetic target. Initial read-only inspection compared the entire actual `prosrc`, `pg_get_functiondef`, OID, owner, ACL, configuration, language, signature and security attributes against the prior independently captured mode600 file:

`/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/aad-review-bill-detail-catalog-20261016.json`

Every compared value matched. Initial bill detail OID `61303`, owner `ourhoomu_core_writer`, source MD5 `161704d41ad0681f0333a82508718a49`, ACL writer/app EXECUTE only, `SECURITY DEFINER`, `search_path=pg_catalog`. Accepted private-destination AAD 0004 remained applied with source MD5 `ec26048eea809fd890d618ba42864213` and OID `61299`.

Every database invocation used checked-in `loadTarget()` and explicit environment assignments:

```sh
SYNTHETIC_DB_ENV_FILE=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env
NEON_BRANCH_RECEIPT=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json
```

Mode600, exact target/receipt/expiry, direct owner endpoint and restricted role URL guards passed. No credential contents were printed or copied to this report. No production connection, reset, destructive cleanup, provider or deployment action occurred.

Temporary audit harness `/tmp/ourhoomu-bill-actions-security-review.ts` ran the exact checked-in up/down SQL. Harness SHA256: `5ec65048f463216463df57d38529e39fdaedc133a09e3f4888fe9d2d16d26d91`. Up SQL SHA256: `2e616611b4cdacf06bc1eca373119700b793158b189131ed4c5b08dfb9a1c58e`. Log: `/tmp/ourhoomu-bill-actions-lifecycle.log`.

All lifecycle steps passed, exit 0:

- Rollback on accepted predecessor is a no-op; apply reaches exact new hash; reapply is a no-op.
- Rollback restores the exact old source; final reapply restores the exact new source.
- Both up and down refuse unknown source, SECURITY INVOKER tampering and an added PUBLIC EXECUTE ACL. Tampering occurs only in transactions that are rolled back; baseline is rechecked afterward.
- Each step preserves OID, owner, ACL, configuration, argument/result signature, language and security mode. A digest of every other core function's source/catalog/security values and all core table row counts stays unchanged. `runtime_probe` stays present.

## Verification commands and results

Commands ran at the exact source SHA above. Database commands used the guarded environment above; Bun scripts ran from `ourhoomu-api/`.

- Root `bun install --frozen-lockfile`: PASS, Bun 1.4.3; 699 packages installed. No tracked files changed.
- `bun scripts/db/check-bill-detail-actions-migration.ts`: PASS.
- `bunx drizzle-kit check`: PASS.
- `bun run typecheck`: PASS.
- `bun /tmp/ourhoomu-bill-actions-security-review.ts`: PASS lifecycle/refusal/preservation checks; pool awaited closed.
- `bun scripts/db/check-read-parity.ts`: PASS all eight restricted-role groups, exit 0. Log: `/tmp/ourhoomu-bill-actions-parity-00fff178.log`. New assertions cover exact five action keys, draft action values with cross-recipient account, null draft amount/remaining, zero draft reservations, 21 reserved satang while gross remaining remains 720000000000, owing-payer payment/private-account affordances and denial of those affordances to a non-owing member. Existing privacy, house boundaries, frozen AAD, expiry, removal and revocation assertions also pass.
- Final guarded read: PASS bill detail OID `61303`, new MD5 `995b2caafec89212c9409d849e1bde44`; private destination OID `61299`, unchanged accepted AAD MD5. Both retain exact owner, ACL, signature, SECURITY DEFINER and pinned search path. FORCE RLS remains enabled on all 23/23 core tables; `runtime_probe` retained.
- `git diff --check`: PASS before report completion. Report-only staged whitespace check also passed.

Final state leaves accepted 0004 and reviewed 0005 applied. Restricted app/auth, owner and reviewer pools were awaited closed. **The exclusive database window was explicitly released to the Lead after the final read.** Synthetic fixtures remain. The full legacy general-invariant suite was not rerun in this bill-only review; its earlier stale dashboard assertions are tracked separately. Actual end-to-end HTTP DTO/browser acceptance remains the integration owner's responsibility.

Graft: `graft grep 'bill_detail'` succeeded, estimated 12,874 tokens saved. SQL was not covered by those indexed spans, so exact migration/rollback/body diffs were inspected directly.
