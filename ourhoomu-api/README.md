# OurHoomu API

This package is the Elysia API foundation for Cloudflare Workers. The bounded
SW-0038 runtime proof exposes only health from the production entry. Request
validation and Neon actor probes exist in the separate test-only entry;
product routes, session authentication and database schema belong to their
accepted tickets.

## Requirements

- Bun 1.4.3 (root workspace pin)
- Node.js 24.15.0 (root workspace pin)

## Setup and checks

Install once from the repository root with `bun install --frozen-lockfile`.
The root workspace uses isolated dependencies and retains API TypeScript 7.0.2.
Then, from this directory:

```sh
bun run format:check
bun run lint
bun run typecheck
bun run test
```

Biome 2.5.15 is pinned for formatting and recommended lint checks on API
TypeScript in `src/`, `scripts/` and `tests/`, plus `package.json` and
`biome.json`. The formatter uses two spaces, single quotes and a 100-column
line width. Run `bun run format` to apply formatting; `format:check` and
`lint` check without writing files, and lint warnings fail the check.
Import assist actions are disabled so formatting does not reorganize the
production or fixture import graph. These commands exclude generated files,
locks, SQL, Markdown, Wrangler/TypeScript runtime configuration and the
root/frontend packages.

Tests use Bun's test runner over `tests/`, including pure unit helpers in
`tests/db/`; executable DB fixtures and guarded DB scripts are not ordinary tests. The local unit tests cover the health/error envelope, hidden production fixture routes and secure
synthetic database URL guard. TypeScript also checks test-only fixtures, but
Wrangler's production entry remains `src/index.ts`.

Start the production entry locally in Wrangler/workerd:

```sh
bun run dev
```

Run the production request matrix while Wrangler is running in a second
terminal. Start Wrangler on a dedicated unused loopback port (do not use the
default `8787` when another process already owns it), then point the check to
that exact server URL. The check validates the health success envelope and
request ID, plus hidden proof routes and 404 error envelopes:

```sh
bunx wrangler dev --config wrangler.jsonc --ip 127.0.0.1 --port 18787
RUNTIME_BASE_URL=http://127.0.0.1:18787 bun run check:runtime
```

The runtime check requires `RUNTIME_BASE_URL` and refuses non-loopback URLs.
`check:runtime` validates the production entry; use `check:fixture-runtime` only
against the separate test-only worker below. Error checks require the exact
contract status/code pairs (400 validation, 401 unauthenticated, 404 not found),
not just any client-error response. A successful response from the fixture
worker is not evidence about production routing.

The Neon proof uses a separate Wrangler config and test-only entry. The Lead
must provision a schema-only synthetic Neon branch and provide two ignored
local files: `SYNTHETIC_DB_ENV_FILE` with its direct migration URL and branch
metadata, and `NEON_BRANCH_RECEIPT` with the authoritative branch-to-endpoint
mapping. The setup command checks both before any SQL, creates only the
`runtime_probe` schema and a restricted `ourhoomu_runtime_probe` role, and
writes an ignored mode-600 `.dev.vars` for local Wrangler. It can also reuse a
previously prepared restricted URL. Never use production or a pre-existing
developer branch.

In this directory, with both path variables set to those private files:

```sh
bun run prepare:neon-runtime
bunx wrangler dev --config wrangler.runtime.jsonc --ip 127.0.0.1 --port 18788
```

While Wrangler is running, use another terminal in this directory with the
same path variables:

```sh
RUNTIME_BASE_URL=http://127.0.0.1:18788 bun run check:fixture-runtime
bun run check:neon-runtime
```

The check exercises two actors through real `workerd` requests, a forced
rollback, an immediately following request, and direct read-only checks of
the restricted role and empty actor context. Stop Wrangler and remove the
ignored `.dev.vars` after the proof. The private credential file stays in
the Lead's ignored audit store; never add it to Git.

The local dry-run bundle can be checked with:

```sh
bun run build:worker
```

Neon schema migrations and product data remain owned by the data-engineer
ticket. The API must derive authority from verified server sessions; callers
cannot supply actor IDs as authority. See [the API contract](../docs/project/api-contract.md),
[domain model](../docs/project/domain.md), [database design](../docs/project/database.md),
and [ADR-0002](../docs/adr/0002-neon.md).


Shared wire DTO types come from `@ourhoomu/contracts`, with the existing
`src/http/dto.ts` compatibility path preserved. The frozen schema remains
`docs/project/openapi.yaml`; run `bun run generate:contracts` at the root.
Drizzle schemas, SQL and runtime validation stay server-only. Root `build`
includes a local dry-run bundle in `dist/worker/`, never a deploy. Runtime and
DB proof commands remain explicit/noncached and keep their authorization gates.
## Core data milestone (SW-0004)

`src/db/schema.ts` declares 23 core PostgreSQL tables, including anonymous HTTP
retry locators and migration-only reversal metadata. Drizzle Kit 0.31.11 generates
`drizzle/0000_core_schema.sql`; the registered custom migration
`0001_core_operations.sql` defines atomic routines, composite constraints, FK
indexes, grants and default-deny RLS. Additive `0002_house_timezone.sql` corrects
`house.update` to require a PostgreSQL-catalog timezone and atomically save
name/timezone/version. Generation is offline; neither the Drizzle
config nor the migration script reads linked root environment or Neon config.

Additive `0003_http_seam.sql` adds authorized HTTP projections, required invitation
TTL (integer 1–604800 seconds), command-bound member snapshots and DB-authoritative
challenge/exchange retries. Both auth operations require route-scoped HMAC key/body
evidence from the server. Exchange first use also requires verified issuer claims;
preflight never creates a session. Exact encrypted exchange results last at most
five minutes and require a still-active original session/family after the family
root lock. Anonymous locators expire within 24 hours; the existing janitor clears
expired locators, challenges and replay payloads. These primitives do not verify
provider signatures themselves or establish a production janitor schedule.
SW-0037 retains the physical pruning, scheduling and operational evidence gate.

On the accepted existing synthetic schema, apply only the additive mode:

```sh
bun scripts/db/migrate.ts patch-http-seam
bun scripts/db/check-http-auth.ts
bun scripts/db/check-http-seam.ts
bun scripts/db/check-http-schema.ts
```

`patch-http-seam` serializes migration attempts and verifies the candidate SHA and
routine fingerprints on reapply. `rollback-http-seam` restores the saved accepted
routine definitions and refuses if retry locators/member snapshots remain or the
candidate/fingerprints differ. It preserves existing product tables, role OIDs
and `runtime_probe`. The migration temporarily grants schema CREATE to assign new
routine ownership, then revokes it within the same transaction. Never use the
schema-reset `rollback` mode for this correction.

These rehearsals require an exclusive synthetic DB window. The lifecycle check
deliberately ages disposable HTTP retry fixtures through the janitor before
rollback; run it only before handing the DB to another worker. After it, the
schema is at the accepted pre-HTTP version until reapplication:

```sh
bun scripts/db/check-http-seam-lifecycle.ts
bun scripts/db/check-http-seam-migration.ts
bun scripts/db/migrate.ts patch-http-seam
```

`CoreTransaction.me()` includes all current houses. Lists accept UUID cursors
ordered by ID, default to 20 rows and allow at most 100. `account()` and
`accounts()` return only the owner's masked DTO; `accountSecret()` is a separate
server-only encrypted record. Partial account updates preserve omitted encrypted
identifiers. Archived accounts reject updates/reactivation. `ownMembership()` and
owner-only `targetMembership()` return only ID/version for versioned commands in
the same principal transaction. Only leave/remove/invite.accept may return a
five-minute command-bound `data` member snapshot; removed actors remain hidden on
subsequent membership reads/retries.

```sh
bunx drizzle-kit check
bunx drizzle-kit generate
```

Run database commands only with `SYNTHETIC_DB_ENV_FILE` and `NEON_BRANCH_RECEIPT`
explicitly set to the Lead's ignored mode-600 credential file and authoritative
branch-create receipt. The guard pins project `lucky-bar-14515304`, branch
`br-weathered-thunder-b38dgxbm`, endpoint `ep-dry-breeze-b3e8t69s` and expiry
2026-10-20T12:00:00Z. It rejects pooled migration URLs and role/endpoint/receipt
mismatches before SQL. The migration uses the direct owner URL and writes separate
restricted pooled app/verifier URLs to that private file; it never reuses
`RUNTIME_DATABASE_URL` or changes `runtime_probe`.

```sh
bun scripts/db/migrate.ts up
bun scripts/db/check.ts
bun scripts/db/check-sessions.ts
bun scripts/db/check-session-races.ts
```

`up` requires an empty `core` schema and applies all registered migrations.

For an existing accepted core schema, apply SW-0054 without resetting data,
roles, sessions or `runtime_probe` (same guarded path variables as above):

```sh
bun scripts/db/migrate.ts patch-house-timezone
bun scripts/db/check-house-timezone-migration.ts
bun scripts/db/check-house-timezone.ts
bun scripts/db/check.ts
bun scripts/db/check-sessions.ts
bun scripts/db/check-session-races.ts
```

The patch rejects an unexpected prior function body and is safe to reapply.
The migration check uses owner-only transactional DDL/savepoints to prove
rollback and preservation of function identity/security, role IDs and probe;
all changes in that check roll back. The timezone regression uses only restricted
app/auth connections and real synthetic actors, with database readback for valid,
invalid/missing, stale, nonowner, removed-owner and retry cases. Existing schedule
revisions/occurrences retain their saved timezone/local dates; newly saved rules
must use the current house timezone. Run these scripts in the Lead's exclusive
synthetic DB window. They are not provider or native identity proof.

The following destructive rehearsal is **only** for a separately authorized
disposable reset; do not use it to apply SW-0054 to the accepted schema:

```sh
bun scripts/db/migrate.ts rollback
bun scripts/db/migrate.ts up
bun scripts/db/check.ts
bun scripts/db/check-sessions.ts
bun scripts/db/check-session-races.ts
```

Rollback drops **only `core`** on this exact authorized synthetic target. It
retains the hardened app/auth/writer role identities and credentials because
PgBouncer can retain authenticated backends across schema rehearsals. It does
not implement a rollback for a database containing real product money. The
Lead owns branch lifetime, role removal, integration and final cleanup.

`CoreDatabase` accepts only `ourhoomu_core_app`, which cannot write tables,
execute auth/bootstrap routines or assume `ourhoomu_core_writer`. That dedicated
non-login role owns the schema-qualified routines with fixed `pg_catalog`
search paths and no PUBLIC EXECUTE. All 23 tables enable and force RLS. Runtime
reads use live membership, parent expiry and private-viewer predicates; the
runtime cannot read invitation digests, session/identity tables or private bank
snapshot columns directly.

`SessionStore` uses the separately restricted `ourhoomu_core_auth` credential.
Its exchange primitive is for the **trusted backend issuer verifier**, after
signature/audience/nonce verification; it is not a public login endpoint or a
provider verifier. Its access-digest lookup produces a branded server principal.
`CoreDatabase.withPrincipal` revalidates that principal against active database
session/family/user state, sets parameterized transaction-local user/session
context on one WebSocket client and commits or rolls back the entire callback.
Serialization/deadlock failures retry the whole callback at most three times.
Callbacks must contain database work only and retain the same logical request
key; provider/network effects must happen outside them. Database credentials
remain server-only: custom settings cannot defend against a credential holder
impersonating a session it already knows.

`CoreTransaction.command` has typed inputs for house/invite/member/account,
bill draft/publish/void, payment reservation/cash decision/cancellation,
chore creation/transition, recurring schedule revision/generation and activity
read cursor. It returns a resource locator, never a cached wire DTO. Handlers
must refetch and explicitly project the frozen OpenAPI DTO and fresh action
flags. Internal SQL JSON rows use snake_case; ORM rows use camelCase and BigInt.
Dashboard totals are exact decimal strings. Read methods expose safe member,
bill/payment/chore, selector, encrypted authorized destination and dashboard
records; transport pagination/opaque cursors and wire projection belong to the
feature handler tickets. Opaque payment routes use `resolvePaymentHouse` / `paymentById` for minimal
internal parent resolution with fresh membership, followed by command authority
checks under the house lock. No product route is registered by this milestone.

Commands take their user/house scope lock before locking the immutable
session-family root, then recheck the actor before replay or mutation. The shared
family lock lasts until transaction end, including later account waits during
publish. Verifier revoke/rotate/reuse and app logout take that root exclusively;
logout takes it exclusively from the start to avoid a lock upgrade. This lets
revocation commit during an earlier scope wait and reject the waiting command,
or wait for an already authorized command transaction to finish. The bounded
`check-session-races.ts` suite observes actual backend blocking edges and covers
both orders, child waits, replay and a rotated family. Run it only in the Lead's
exclusive synthetic database window; fixtures and deliberate revocations persist,
while pending mutation probes roll back.
The user scope uses `FOR NO KEY UPDATE`: it still serializes account commands,
while permitting session rotation's foreign-key `KEY SHARE` on that user.

Money mutations lock house → session-family root → bill → ordered shares/attempts → idempotency and
immutable credit/activity. Non-history locators last 24 hours; history locators
last through parent access expiry, capped at their own 364 days. Invitation
issuance retains its semantic key for the full seven-day invitation lifetime;
only an exact retry within five minutes receives the original encrypted result,
and later known-key retries return 409. After a generic locator expires there
is no cached-success guarantee; clients must refetch uncertain state before a
new logical operation. Replay always rechecks live authority and parent expiry.

`requestEvidence` hashes the exact HTTP body and HMACs the request key on the
server. Never accept either digest from a client. `sealReplay` / `openReplay`
provide AES-GCM with actor/route/key scope as authenticated data; backend-owned
keys remain outside the DB. Invitation/refresh callers supply only digests and
encrypted replay envelopes. The database enforces five-minute replay access;
`core.clear_replay_secrets()` is verifier-only housekeeping. Scheduling that
cleanup and proving physical deletion of DB/backup/provider copies remain
SW-0037. Synthetic DB tests use visibly fake envelopes, while the isolated
WebCrypto unit test proves encryption, tamper rejection and scope binding.

The database checks are real restricted-role synthetic integration and
concurrency tests, not login/provider/native evidence. Transfers can reserve
but cannot be credited by core cash routines. SlipOK/reference/slip/LINE,
physical purge, restore fencing, deployed Workers and native identity proof
retain their separate acceptance gates.

## Core HTTP handlers (SW-0005)

The Elysia registry serves `/v1/auth/challenges`, `/auth/exchange`, `/auth/refresh`,
`/auth/logout`, `/me`, houses, members, invitations and owner recipient accounts.
All paths after the first example share the `/v1` prefix. `DELETE /v1/me` remains
`503 feature_unavailable`: destructive account deletion and fresh provider
reauthentication are separately gated. Live native Google/Apple acceptance is
also pending; signed synthetic issuer fixtures are explicitly test-only.

Core handlers require every binding below. Missing/invalid configuration fails
closed with an opaque `503`, while `/health` remains available. There are no
actor-header credentials, unsigned-token fallback or implicit production login.
Keep binding files ignored and server-only; never print or commit their contents.

| Binding | Required value/policy |
| --- | --- |
| `CORE_APP_DATABASE_URL` | Restricted `ourhoomu_core_app` connection for the accepted core schema |
| `CORE_AUTH_DATABASE_URL` | Separate restricted `ourhoomu_core_auth` connection to the same database |
| `CORE_HMAC_KEY` | Independently generated random 256-bit key, encoded as 64 lowercase hex characters |
| `CORE_AES_KEY` | Different random 256-bit key with the same encoding; AES-GCM ciphertext never stores plaintext credentials |
| `CORE_KEY_VERSION` | Explicit `1`; unsupported key versions fail closed |
| `CORE_ACCESS_TTL_SECONDS` | Required integer, 1–3600; approved synthetic setup uses 900 |
| `CORE_REFRESH_TTL_SECONDS` | Required integer, at least access TTL and at most 31536000; approved synthetic setup uses 2592000 |
| `CORE_ISSUERS` | JSON object keyed by `google` and/or `apple`, each with trusted HTTPS `issuer`, exact `audience`, trusted HTTPS `jwksUrl`, pinned `algorithms` (`RS256`/`ES256`), and optional explicit `trustedPresenters` |

These lifetimes are explicit development settings, not production defaults.
Refresh rotation retains the original absolute family expiry, and the API reads
canonical expiry from the verified database session after rotation. Runtime
issuer configuration is server-owned; HTTP bodies cannot choose audiences,
issuers, algorithms or key URLs. JWKS loading rejects redirects and fails closed.

Every mutation requires a UUID `Idempotency-Key`. JSON bodies are bounded to
16 KiB and reject unknown input fields. Keep the exact body bytes and key for an
uncertain retry; changed-body retries conflict. A challenge accepts a fresh
32–128-character random base64url `clientNonce`. Send the returned server `nonce`
to the provider and send the original `clientNonce` as `proof` during exchange.
The server derives the nonce with a purpose-bound HMAC of provider, challenge ID
and client proof. The database enforces provider/proof binding, five-minute
validity and one-time consumption. Exact exchange retries look up the previously
verified encrypted result before issuer verification, allowing a lost-response
retry even after that original ID token expires; active session/family checks
still apply. Challenge/exchange require the accepted additive auth replay seam.

Refresh and exchange replay store encrypted credentials for at most five minutes;
invitation issuance stores only a token digest plus similarly bounded encrypted
replay. Invitation lifetime is 1–604800 seconds. Encryption authenticates purpose,
version and request/owner scope. Recipient identifiers are encrypted and have a
separate HMAC blind index; general account/member/profile DTOs contain no raw
account identifier, ciphertext, digest or global member user ID. The account
management DTO itself is masked, as specified by the frozen contract.

Focused synthetic, in-process HTTP and crypto checks use Bun Test:

```sh
bun test tests/auth
bun run typecheck
bun run format:check
bun run lint
bun run build:worker
```

Tests exercise real Elysia handlers and signed synthetic JWT verification with
an in-process authority fixture; they do not establish database, provider or
native acceptance. Real API acceptance must run against the accepted synthetic
core schema with both restricted roles, dedicated local servers and Playwright
HTTP checks, only after the Lead grants the exclusive DB window. Never reuse the
linked production URL. Returned lists default to 20 and cap at 100; cursors bind
to the authenticated user and route and every page rechecks database authority.

The separate `http-acceptance/core.spec.ts` Playwright suite starts a dedicated
loopback Bun server with these same Elysia handlers, restricted database roles
and an explicitly synthetic signed issuer. It covers session replay/rotation,
0/1/many houses, cross-house denial, version conflicts, invitation/member
lifecycle, recipient privacy and logout. It does not use browser binaries or
prove workerd/database compatibility, native login or live provider behavior.
The directory deliberately avoids `tests` in its name so `bun test tests`
continues to discover only Bun tests.

After the Lead grants the exclusive synthetic DB window and accepts the
required SW-0059 data/auth replay seam, set `SYNTHETIC_DB_ENV_FILE` and
`NEON_BRANCH_RECEIPT` to the existing guarded target artifacts described above.
Also set `CORE_HTTP_BINDINGS_FILE` to an ignored, mode-600 file with the bindings
in the table, matching those guarded restricted connection URLs exactly. Its
only issuer must be `google`, with issuer `https://synthetic.invalid`, JWKS URL
`https://synthetic.invalid/jwks`, audience `core-http-acceptance` and algorithm
`RS256`. The fixture supplies its own in-process public key and makes no provider
requests. Then run from `ourhoomu-api/`:

```sh
export ALLOW_CORE_HTTP_ACCEPTANCE=true
export CORE_HTTP_TEST_SHA="$(git rev-parse HEAD)"
bun run test:http
```

Record that SHA, command, outcome and exclusive-window grant in the ticket
report. No schema reset or migration runs as part of this suite; its random
synthetic identities and records are written only to the guarded dedicated DB.
Playwright request traces, screenshots and video are disabled to avoid storing
credentials. Do not capture HTTP request/response bodies in shared test logs.
