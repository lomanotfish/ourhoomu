# SW-0005 core HTTP implementation

## Scope and checkpoint

Worker: backend-engineer, task `task_6b34d2b62c5c`, dispatch
`ctx_4b754b600f93` (resuming preserved prior dispatch
`ctx_8cb8a8c1c064`), branch `witchagorn/sw-0005-core-api`, base
`1864cc584baf64f28b60c504e4ecb3ddc6605648`, local integration target.
This worker does not own DB/schema/SQL, shared contracts/manifests/locks,
frontend, ticket status, integration or cleanup. No nested workers were opened.
Read AGENTS, requirements, board, SW-0005, approved core plan, agent guide,
installed Graft/runtime, minimal-change and test-first guidance. Session runtime
is never/danger-full; actual parent PID 65912 was observed as
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`.

Implementation covers real Elysia routes for challenge/exchange/refresh/logout,
profile, house list/create/detail/update, members, invitation issue/accept/revoke,
leave/remove and owner account list/create/update/archive. Private DTOs are
explicitly projected. The index uses required fail-closed runtime bindings;
there is no HTTP actor impersonation or fake production login.

`DELETE /v1/me` is explicitly unavailable. Its destructive workflow, recent
provider reauthentication, open-bill and ownership guards have no reviewed data
command. Lead confirmed this separate gate; returning 503 is not completing
SW-0005-AC2. Real Google/Apple/Managed/native proof also remains gated.

## Approved security/transport choices

Lead approved explicit local-only TTLs (access900s, refresh2592000s), bounds
access1..3600 and refresh>=access/<=31536000; no production defaults. Required
independent 256-bit HMAC/AES keys are lowercase hex bindings, key version1.
AES-GCM reuses the existing bounded `sealReplay`/`openReplay` implementation and
authenticates version, purpose and request/owner scope. Keys never enter SQL or
DTOs. Account identifier digests and challenge nonces use distinct HMAC domains.
Cursor signatures use WebCrypto verification and bind user plus route.

Challenge nonce binds provider, DB challenge ID and original client nonce;
exchange proof is that original nonce. DB one-time consumption, provider/digest
binding and expiry remain authoritative. Exact exchange replay uses a read-only
DB preflight before issuer verification, so a previously verified request may
retry after the original ID token expires, only within the encrypted replay
window and while the canonical session remains active. Fresh exchange still
verifies signature, issuer, exact audience, presenter, nonce and recent auth_time
through the accepted issuer adapter. Email is never an identity/linking input.

Only opaque random256-bit API credentials are issued. Canonical access
verification supplies user ID and expiry after exchange/refresh, including the
DB absolute refresh-family cap. Refresh replay scopes old-token digest,
idempotency digest and exact body hash. Revocation/rotation wins over replay.
Every mutation requires a UUID key. Body reading caps actual and declared bytes
at16KiB, requires JSON and rejects invalid UTF-8/unknown fields. Public errors
carry request IDs and never raw SQL/token/account details; only version conflict
carries currentVersion.

## Data dependency and database window

No database calls have been made at this checkpoint. SW-0054/SW-0060 owns the
exclusive synthetic window until Lead release, then SW-0059 supplies additive
projections and auth replay authority. This worker reported exact gaps early
and did not implement handler SQL or bypass grants. Requested seams are me,
house, ownMembership, owner-only targetMembership, ownAccounts/ownAccount,
accountSecret, invitation; command-bound member snapshots; configurable invite
TTL; challenge/exchange evidence locators and bounded encrypted replay/preflight.
See Lead's SW-0059 for accepted data implementation and independent review.

The runtime adapter checks these projection methods before using them and fails
closed if the accepted data API is absent. House timezone is forwarded intact;
no value is silently dropped. Account bank changes re-encrypt the existing
identifier with the new bank's blind index when no new number is supplied.
Archived reactivation is not introduced. Live membership and data locks continue
to enforce house boundaries; inactive membership DTOs come only from authorized
command results. Last-owner/open-bill/role checks remain data-owned.

## Verification checkpoint

Bun1.4.3 frozen install succeeded without manifest/lock changes. Focused tests
exercise real Elysia handlers, WebCrypto, and signed RSA synthetic issuer tokens
using an explicitly in-process authority fixture. They cover fail-closed config,
actor-header rejection, one-time proof, nonce/expiry, exact challenge/exchange
replay, refresh body-exact replay and reuse revocation, validation/body limits,
error/DTO minimization, pagination, timezone forwarding, encrypted account input
and command-bound leave response. These fixtures do not prove real DB authority.

Red observations included missing handlers returning404 instead of required
503/401; absent crypto behavior; unconfigured validation; version leakage on
non-version errors; missing challenge/exchange idempotency enforcement; and
non-JSON mutations being accepted. Each was corrected with the corresponding
focused check rerun. Initial missing dependencies were resolved by the frozen
install; fixture response typing was corrected without weakening typecheck.
Worker dry-run build and typecheck have passed during implementation. Final
command counts, tested commit and DB/Playwright evidence will be appended after
required final checks and the exclusive-window decision.

## Graft checkpoint

Graft ACTIVE, CLI0.21.1, exact checkout. Initial `graft map` returned71 files,
342 symbols and892 edges. Used scoped auth/DB retrievals, connection/contracts
skeletons and callers before multi-file wiring. Latest
`graft callers coreDataHttp --depth 2` refreshed17 changed files and returned
coreHttp/createApp callers; `graft check` reported wiring in sync. Meaning/deep
layer intentionally not built. Raw reads were used for nonindexed SQL/docs/config
and truncated source spans. Tool-estimated savings, not measured billing savings,
will be tallied in the final evidence; repeated orientation calls are included.

## Remaining acceptance

- Real restricted-DB HTTP/Playwright acceptance: pending accepted additive seam
  and exclusive grant; no fixture result is substituted for it.
- Live issuer/native Google/Apple proof, provider credentials and compatibility:
  pending separately authorized real environment evidence.
- Account deletion/reauthentication and destructive guards: explicitly gated.
- Review, local integration and cleanup: Lead-owned after delivered commit.

## Resumed dispatch checkpoint — 2026-10-16

Current dispatch `ctx_4b754b600f93`, task `task_6b34d2b62c5c`; source commit
`eed94201d5d8c515f1a1e4f62fd13020349594a6`. The substantial dirty implementation
and original report above were preserved from the interrupted dispatch, then
reviewed and completed without rebuilding them. The original red-test
observations and PID belong to that earlier attempt. This dispatch observed
parent PID 61376 launched as
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`; session policy
is `never` / `danger-full-access`. No workers were spawned.

The Lead's durable resume message explicitly authorizes the narrow API
`@playwright/test` dependency, corresponding root lock entry, focused HTTP test
configuration/scripts/types and dedicated synthetic Bun HTTP server. It retains
`DELETE /v1/me` as unavailable and forbids DB calls before an explicit grant.
Current SW-0059 was read in the Lead checkout. No DB calls, migrations, provider
requests or deployment occurred.

### Corrections and verification

- Fixed reproducible test discovery failure: `bun test tests` matched
  `http-tests/core.spec.ts` and failed on Playwright `test.beforeAll`. Moving the
  suite to `http-acceptance/` resolves it; Playwright lists its seven cases while
  Bun discovers ordinary tests only.
- Included focused HTTP config/tests in formatter/linter coverage and formatted
  resumed drafts; no quality rules were weakened.
- Cursors use existing WebCrypto MAC verification. Added real-handler checks
  for tampered/other-route cursors, invalid limits, bank-only identifier
  re-encryption, actual oversized bytes and invalid UTF-8. These exercise
  Elysia/crypto with explicit in-process authority fixtures, not real DB policy.
- Appended precise runtime/acceptance setup and evidence limits to API README.

| Command/evidence | Observed result |
| --- | --- |
| Bun / `.bun-version` | Both 1.4.3 |
| Root `bun install --frozen-lockfile` | Exit 0, 707 installs / 855 packages, no changes |
| API `bun run typecheck` | Exit 0 |
| API `bun run format:check` | Exit 0, 44 files |
| API `bun run lint` | Exit 0, 44 files |
| API `bun run test` | Exit 0, 88 tests / 249 assertions, zero failures, 10 files |
| API `bun run test:http --list` | Exit 0, seven cases in one file; no DB execution |
| API `bun run build:worker` | Exit 0, dry-run only, 1406.80 KiB / gzip 275.29 KiB |
| Dedicated actual workerd, loopback port18875 | Runtime script passed health, hidden proof route, unknown route and CORS; extra probes confirmed profile401, challenge503, actor-header rejection, no-store and matching request IDs |
| `git diff --check` | Exit 0 |
| `graft check` | Exit 0, wiring in sync, 508 nodes; deep layer intentionally absent |

Workerd showed only existing APP_ENV and ALLOWED_ORIGIN bindings. Its dedicated
Wrangler process was terminated after verification; no listener for this
worker's port remains. Workerd/database compatibility is not established by the
Bun fixture or these unconfigured-runtime probes.

Graft: **ACTIVE**, CLI0.21.1, this exact checkout. Scoped auth/core/DB queries,
skeletons and `coreDataHttp` callers preceded the relevant source reads. Nine
retained figure-bearing retrieval outputs total **40,733 estimated tokens
saved**; an earlier compressed orientation output is excluded, and this is not
a billing claim. Raw reads covered nonindexed docs/config/SQL and necessary
truncated source spans.

### Handoff boundary

Auth/session, profile, house/member/invite and recipient account HTTP code is
committed with explicit DTO projection and fixture proof. Baseline DB lacks
the required projection/auth replay port; runtime remains unavailable instead
of inventing grants, SQL or actor authority. A durable blocking Orca ask requests
final SW-0059 account method names (`ownAccounts`/`ownAccount` here versus the
resume note's `accounts`/`account`), accepted data commit and exclusive DB grant.

Seven Playwright cases await actual guarded restricted-DB execution: signed
synthetic login/0–1–many houses; auth replay/expired proofs; concurrent refresh
and reuse revocation; house version/timezone/idempotency; invitation/member
privacy/removal/revoke; private account edit/archive; logout/replay denial.
Listing these cases is not execution evidence. Independent review, integration
and cleanup are Lead-owned; live Google/Apple/native and destructive deletion
remain gated. This checkpoint does not close full SW-0005 acceptance.

## Lead-requested file-only acceptance setup

Lead confirmed canonical data names `accounts()` / `account(id)`; injectable
HTTP aliases can remain and the real adapter mapping waits accepted SW-0059.
Lead requested the frozen HTTP snapshot for independent review and explicitly
kept this dispatch active without a final outcome while data acceptance waits.
Snapshot `38107fb58c6c19dd34ba10e654c14faf626f5208` contains the source/report
above and remains the frozen HTTP review target.

Subsequent setup-only commit `77b16c7` adds
`ourhoomu-api/tests/fixtures/prepare-core-http.ts` and its focused tests, without
changing the frozen HTTP implementation or adapter. With the pre-existing
explicit guarded `SYNTHETIC_DB_ENV_FILE` and `NEON_BRANCH_RECEIPT` set, run from
the API directory:

```sh
bun tests/fixtures/prepare-core-http.ts
```

The executable validates the existing receipt/expiry/target and restricted
roles before writing. It performs no DB or provider calls, does not read root
linked production env, copies only the two guarded restricted role URLs and
generates fresh independent 256-bit HMAC/AES keys. Its output is
`/Users/afe/Desktop/ourhoomu/.git/core-finish/sw-0005-http.env`, mode600, under
the actual common Git directory; an occupied path is refused. It prints only
that path, never values. The Lead executes it; this worker has not run the real
generator or test server.

The file contains exactly `CORE_APP_DATABASE_URL`, `CORE_AUTH_DATABASE_URL`,
`CORE_HMAC_KEY`, `CORE_AES_KEY`, `CORE_KEY_VERSION=1`,
`CORE_ACCESS_TTL_SECONDS=900`, `CORE_REFRESH_TTL_SECONDS=2592000` and
`CORE_ISSUERS`. Issuer JSON shape is deliberately synthetic:

```json
{"google":{"issuer":"https://synthetic.invalid","audience":"core-http-acceptance","jwksUrl":"https://synthetic.invalid/jwks","algorithms":["RS256"]}}
```

The existing dedicated test server creates its RSA signing keypair in memory
at later authorized startup and explicitly injects that public JWKS into the
issuer verifier. No signing private key is persisted or accepted by production
runtime; no actor-header shortcut is introduced.

Test-first evidence: absent module initially failed, then a stub failed the
positive file-creation case; complete generator passed both focused cases with
12 assertions. They check exact field minimization, restrictive permissions,
fresh keys, refusal to overwrite and rejection of missing/wrong roles, wrong
target and newline injection, using temporary fake-credential files that are
removed after each test. Fresh typecheck/format/lint pass (46 files); full unit
suite now passes90 tests /261 assertions, zero failures across11 files.
No DB window has been granted and no real DB acceptance has run.

## SW-0062 byte-evidence correction

Lead relayed independent SW-0062 reproduction on frozen source: default UTF-8
decoding strips a leading BOM before body hashing, allowing distinct request
bytes to share refresh evidence. This worker reproduced it in a real Elysia
handler test: after a valid refresh, the same-key BOM-prefixed retry returned200
instead of expected400. Review feedback was checked against `boundedBody`
through Graft before the correction.

Focused commit `2a36ca2` sets `TextDecoder` to fatal UTF-8 with `ignoreBOM:true`.
This counterintuitive standard option preserves BOM in the decoded string;
JSON parsing then rejects it before authority/evidence calls. Fatal decoding
continues to reject malformed/noncanonical UTF-8, so accepted bodies retain
their exact byte meaning. No request body is trimmed or normalized for replay.
The new regression passes with BOM400, unchanged valid exact-body replay200
and identical credentials. The guarded Playwright refresh case includes the
same check but still awaits actual DB execution.

Fresh source gates: typecheck, format46, lint46, all91 unit tests /266 assertions
and Workers dry-run (1406.81 KiB / gzip275.31 KiB) pass, exit0. Existing actual
byte-cap and malformed-UTF8 handler checks remain green. A separate temporary
credential-free workerd entrypoint on loopback18876 verified runtime support:
valid JSON decoded unchanged, BOM was preserved and JSON rejected, malformed
UTF-8 threw. This is decoder compatibility evidence only, not DB/handler
integration. Temporary server stopped and files removed afterward.

Graft remains ACTIVE: `graft grep boundedBody` and scoped Playwright `refresh`
lookup reported additional estimates1250+3218 tokens saved (two calls; no
billing claim). Lead has now executed the guarded file-only setup and confirmed
the expected private file at mode600; this worker leaves that file/keys stable.
Independent correction review, accepted SW-0059 mapping and exclusive DB grant
remain pending. No DB calls or final task settlement occurred.
