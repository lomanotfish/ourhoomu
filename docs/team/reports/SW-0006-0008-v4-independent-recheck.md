# Independent domain HTTP recheck

TASK: Bounded correctness review of the active domain HTTP candidate against accepted OpenAPI, database commands and finalized SW-0063 read projections.

STATUS: CHANGES_REQUESTED. Component tests pass but do not establish wire/database integration.

Reviewed workspace: `/Users/afe/orca/workspaces/ourhoomu/v4-domain-api`. Initial source SHA256 was `db1b4ef70327500bc463c9da06dbf64724b23d6e513a5516f3b763aadc54dd48`; the Pi owner changed source during review. Stable reference snapshot `/tmp/ourhoomu-domain-review-snapshot.ts` has SHA256 `aaee74c434719048c2370a1ba7bcdb8decefab0a2db75e6f264bec398bdd2382`. Line references below use that snapshot. Projection reproduction subsequently observed live source SHA256 `f6c5835d28c42d6892394a86dcf81fc5dc853119fb7def1b45c7f8f183a91dff`. Findings must be rechecked against the owner's final commit.

## Findings

1. **P1 — SW-0063 projection interface mismatch.** `ourhoomu-api/src/modules/domain/index.ts:26`, `:256`, `:279`, `:518`, `:586`, `:712`: HTTP declares raw `PaymentRecord`/`ChoreRecord` rows while finalized SW-0063 returns camelCase `PaymentSummaryProjection`/`ChoreProjection`. Inline execution with the finalized read shapes emitted payment `amountSatang:null` and omitted `billId`, `payerMembershipId`, `createdAt`, `expiresAt`; chore output omitted `houseId`, `localDate`, `expiresAt`. Align with the accepted projection interface through an explicit adapter and exercise the real shape in tests. Bill list and dashboard also require actual viewer-derived action adaptation, since the SW-0063 projections do not supply wire action objects.

2. **P2 — Ciphertext returned as a bank account number.** `ourhoomu-api/src/modules/domain/index.ts:210`: `recipientAccountEncrypted.identifierCiphertext` is assigned directly to `recipientAccountPrivate.accountNumber`; OpenAPI `RecipientPrivate` expects the usable account number. The component test at `tests/domain/domain.test.ts:221` explicitly requires `ciphertext-private` in the response, reinforcing the wrong behavior. Decrypt the authorized snapshot through the accepted server-secret purpose/context and key-version checks, or keep the private destination unavailable until the adapter exists. Preserve the database's viewer authorization; this review does not assert that its private-destination authorization is absent.

3. **P2 — Fabricated monetary and action values.** `ourhoomu-api/src/modules/domain/index.ts:202`, `:224`, `:274`, `:288`: bill detail hardcodes `reservedSatang:0`; detail bill/chore/payment action flags are all false. Active pending reservations therefore disappear from the wire representation, and authorized actions cannot be represented correctly. Supply real reservation aggregates and viewer-derived permissions, or explicitly report unavailability. Do not replace missing read evidence with successful placeholder DTOs.

4. **P2 — Schedule PATCH forwards an incomplete command.** `ourhoomu-api/src/modules/domain/index.ts:679`: OpenAPI permits title-only/rule-only/emoji-only patches with `expectedVersion` and `effectiveFrom`, but HTTP forwards only supplied values. `src/db/types.ts:62` requires a complete `ScheduleWrite`; `drizzle/0001_core_operations.sql:345` reads a full rule and inserts a non-null title. A valid partial patch therefore cannot execute correctly. Load and merge an accepted current schedule projection before the atomic versioned command. Until the real schedule read/expiry contract is resolved, keep the operation unavailable rather than inventing schedule fields.

5. **P2 — Invalid calendar input becomes HTTP 500.** `ourhoomu-api/src/modules/domain/index.ts:82`: `new Date(...).toISOString()` throws `RangeError` for a pattern-shaped invalid date such as `2026-99-01`, which the handler maps to `internal_error`. An inline authenticated POST with otherwise valid bill input reproduced status 500. Check the parsed timestamp before conversion and return `validation_error`/400. Include genuinely invalid timestamps, not only dates that JavaScript normalizes.

## Verification

- `bun test tests/domain/domain.test.ts`: 8 passed, 0 failed, 33 assertions. Synthetic in-process authority/transaction stubs only.
- Inline Bun invocation of `domainHttp` with finalized SW-0063 payment/chore projection objects reproduced missing required wire fields and null payment amount.
- Inline Bun invocation of `domainHttpHandler` with a synthetic authenticated principal and invalid bill `dueDate:2026-99-01` reproduced HTTP 500/internal_error.
- Read command types, relevant SQL command bodies, OpenAPI DTO/patch definitions, candidate source and tests.
- Graft-first retrieval returned no matching nodes for this new untracked module; direct bounded source reads followed. No savings claim.
- No database, provider, production, browser or native acceptance executed. No application/test source edited by reviewer.

CHANGED_FILES: This report only, in detached reviewer worktree based on `af41e7b`.

ISSUES: Active owner changes mean these findings apply to recorded snapshots, not automatic rejection of a later corrected commit. Schedule expiry/read contract remains a Lead/user dependency.

NEXT_ACTION: Pi owner corrects HTTP/adapters/tests; data owner resolves any missing projections. Independently recheck the final immutable commit before acceptance.
