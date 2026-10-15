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
terminal. It checks that proof routes are hidden with 404:

```sh
bun run check:runtime
```

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
bunx wrangler dev --config wrangler.runtime.jsonc --ip 127.0.0.1 --port 8787
```

While Wrangler is running, use another terminal in this directory with the
same path variables:

```sh
bun run check:fixture-runtime
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

`src/db/schema.ts` declares 21 core PostgreSQL tables. Drizzle Kit 0.31.11 generates
`drizzle/0000_core_schema.sql`; the registered custom migration
`0001_core_operations.sql` defines atomic routines, composite constraints, FK
indexes, grants and default-deny RLS. Additive `0002_house_timezone.sql` corrects
`house.update` to require a PostgreSQL-catalog timezone and atomically save
name/timezone/version. Generation is offline; neither the Drizzle
config nor the migration script reads linked root environment or Neon config.

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
search paths and no PUBLIC EXECUTE. All 21 tables enable and force RLS. Runtime
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
