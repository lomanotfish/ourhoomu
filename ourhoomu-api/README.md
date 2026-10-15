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

Tests use Bun's test runner in the explicit `runtime.test.ts`,
`runtime-target.test.ts` and `tests/auth/` paths; executable DB fixtures are
excluded from ordinary `test`. The local unit tests cover the health/error envelope, hidden production fixture routes and secure
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
