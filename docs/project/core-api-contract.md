# Core API module interface — SW-0036 proposal

Revision: OpenAPI `0.2.0-proposal` in [openapi.yaml](openapi.yaml). The file is a logical transport contract for local/dev implementation, not evidence of a deployed API. Its 48 operations cover every route in [API contract v0.1](api-contract.md), including the externally gated LINE callback. `x-status: core-approved` means the user approved development of core behavior; it does not assert a handler exists. Other `x-status` values require fail-closed `503 feature_unavailable` until the named proof/credentials and implementation are accepted.

## Principal and session boundary

```ts
type VerifiedPrincipal = Readonly<{
  userId: UUID; sessionId: UUID; issuer: string; subject: string;
  authTime: Instant; expiresAt: Instant;
}>;
type VerifiedActor = Readonly<{ principal: VerifiedPrincipal; houseId: UUID; membershipId: UUID; role: 'owner' | 'member' }>;
interface IssuerAdapter {
  verifyIdToken(input: { provider: 'google' | 'apple'; idToken: string; expectedNonce: string; expectedAudience: string }): Promise<{ issuer: string; subject: string; authTime: Instant }>;
}
interface SessionAuthority {
  exchangeVerifiedClaims(claims: { issuer: string; subject: string; authTime: Instant }, challengeId: UUID): Promise<SessionDTO>;
  rotate(refreshCredential: string): Promise<SessionDTO>;
  revoke(sessionId: UUID): Promise<void>;
  verifyAccessToken(token: string): Promise<VerifiedPrincipal>;
}
```

Issuer and subject jointly identify the person; neither email nor client-supplied user ID links identities. Challenge is single-use, nonce-bound and short-lived. Issuer signature, audience, expiry and nonce are verified before mapping. Refresh rotation is serialized for one credential family; reuse revokes that family. Auth bootstrap/exchange/refresh are `x-status` gated pending real provider/native compatibility and runtime evidence, including Apple on device. Neon Managed Auth is a candidate adapter, not asserted to perform Apple exchange. Session credentials are secrets, never logged. No request body or header may choose the actor, role or house membership.

## Transaction operations

All functions take a server-created transaction context with a fresh `VerifiedPrincipal` and request time. The handler resolves live membership and parent house from the database, including for `/payments/{attemptId}`. The context does not expose client SQL/session `SET`; typed routines use fixed role/grants and parameterized queries. Expiry is checked before data projection and inside a mutation transaction. `403` denotes known forbidden action, `404` hides out-of-scope IDs, and `410` is only for a formerly accessible expired resource.

```ts
interface CoreTransactions {
  createHouse(tx: Tx, principal: VerifiedPrincipal, input: HouseCreate): Promise<House>;
  acceptInvitation(tx: Tx, principal: VerifiedPrincipal, tokenDigest: Digest, key: IdempotencyKey): Promise<Member>;
  publishBill(tx: Tx, actor: VerifiedActor, billId: UUID, input: PublishRequest, key: IdempotencyKey): Promise<Bill>;
  reservePayment(tx: Tx, actor: VerifiedActor, billId: UUID, input: PaymentCreate, key: IdempotencyKey): Promise<PaymentSummary>;
  confirmCash(tx: Tx, actor: VerifiedActor, attemptId: UUID, expectedVersion: number, key: IdempotencyKey): Promise<PaymentSummary>;
  rejectCash(tx: Tx, actor: VerifiedActor, attemptId: UUID, reason: string, expectedVersion: number, key: IdempotencyKey): Promise<PaymentSummary>;
  transitionChore(tx: Tx, actor: VerifiedActor, choreId: UUID, action: 'complete' | 'reopen', expectedVersion: number, key: IdempotencyKey): Promise<Chore>;
  readSlip(principal: VerifiedPrincipal, attemptId: UUID): Promise<PrivateNoStoreStream>;
}
```

Use one canonical lock order: global replay-floor singleton when required → house → aggregate parent (bill/schedule) → share/attempt/occurrence ordered by UUID → idempotency/confirmation/event/outbox. Never call providers or stream bytes under money locks. Idempotency binds principal, route and body hash, returns the same resource for the same key/body, and rejects key/body mismatch with 409. A lost response cannot create another payment. `expectedVersion` is checked under lock and stale 409 includes only a current authorized version/resource projection. DB uniqueness and locks, not in-process mutexes, decide races.

Publish validates exactly 10,000 bps, active same-house participants and active recipient, account ownership/version, integer satang cap 900,000,000,000, and deterministic largest-remainder allocation in one transaction. Recipient share is self-covered without a payment. A bill has a house-local due date; overdue is a badge derived from that date and outstanding balance, not a money state. The bill's full bank destination is projected only to its recipient and payers who owe; everyone else sees masked metadata. `BillListItem` contains aggregate payment totals and masked metadata, never shares or `recipientAccountPrivate`; `Bill` detail applies live viewer projection. Account selector is draft-creator scoped and masked. Payment list and activity expose summaries only; never artifact locators, full bank details, provider raw response or cross-house references.

Transfer reservation is 30 minutes and cash 24 hours, both capped by parent expiry. Cash remains pending until bill creator confirms, including when creator is payer; that self-confirmation writes an explicit audit event. Confirmation checks remaining share under lock and writes immutable credit/event once; no pending amount reduces confirmed debt. Verify lease is 2 minutes, clock tolerance 120 seconds, reconcile cooldown 30 seconds and at most 8 transient retries. Transfer verification and LINE sending are gated: no mock confirmation from HTTP transport status. Replay floor remains monotonic; provider reference precision and late-result UX need provider extension review before transfer credit is enabled.

Slip read rechecks active membership, current uploader-or-recipient identity and parent expiry on every request. House owner and bill creator gain no extra access. It streams from private storage through the API with `Cache-Control: private, no-store`; no read URL, redirect or persistent client cache. Upload is a scoped write target for JPEG/PNG/WEBP up to 5 MiB, followed by server validation and immutable finalize. LINE webhook uses raw-body signature verification before JSON parsing, event dedupe and binding checks; its destination and credential policy remain gated.

Household chores use `YYYY-MM-DD` in the house timezone. Preview is bounded to 14 days, generation to 30, with a unique schedule/date occurrence; completion/reopen is assignee-only and writes one event/version transition. Invitation lifetime is at most 7 days. Lists default to 20 and cap at 100 with opaque stable cursors. Parent access ends at creation + 365 days UTC minus 24 hours, child access no later than parent; physical deletion and backup/provider-copy evidence remain separate release gates.

## Error and visibility rules

Responses use `{data,requestId}` or `{data,nextCursor,requestId}` and `{error:{code,message,fields?},requestId}`. Expected codes include `validation_error` (400), `unauthenticated` (401), `forbidden` (403), `not_found` (404), `version_conflict`/`idempotency_conflict`/`recipient_account_unavailable`/`insufficient_share` (409), `expired` (410), `rate_limited` (429), and `feature_unavailable` (503). 429 includes `Retry-After`. Neither 409 nor 503 discloses another household's account, transfer reference or provider detail. Payment `pending_verification` and `needs_attention` are explicit states, never a paid badge.

The OpenAPI success response combines the envelope and operation data schema with `allOf`; the composed response closes unknown fields with `unevaluatedProperties: false` at the outer level. The shared envelope and data extension remain open within that composition so `requestId` and `nextCursor` are valid alongside typed `data`.
