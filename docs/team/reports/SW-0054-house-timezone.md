# SW-0054 — house timezone patch parity

Date: 2026-10-15. Worker: data-engineer, task `task_ddc31ea54620`, dispatch
`ctx_702a67df8da1`. Branch `witchagorn/sw-0054-timezone`, baseline
`1864cc584baf64f28b60c504e4ecb3ddc6605648`, implementation commit
`2a14613cff44092a9c9cffe416f267d471fd5ce2`.

## Result and scope

`Commands['house.update']` now requires name, timezone and expectedVersion.
Additive migration `0002_house_timezone.sql` validates timezone with the same
`pg_catalog.pg_timezone_names` rule as house creation and updates all three
house fields atomically. It replaces only the existing update statement in
`core.command`, preserving owner/version/house/idempotency checks and the
accepted SW-0049/52 session-family lock order. Accepted migrations 0000/0001
were not edited; no schema reset was performed.

The migration is registered for fresh `up` runs. Existing accepted schemas use
the explicit guarded `patch-house-timezone` mode. This mode does not regenerate
credentials, alter role IDs, migrate any provider data, or touch `runtime_probe`.
The API README documents both paths and the new executable regression checks.
The session-race fixture now includes its required Asia/Bangkok timezone;
its race assertions and production session code remain unchanged.

No handlers, frontend, shared DTOs, lockfiles, board, checklist or ticket status
were changed. Independent review and Lead integration remain pending.

## Red/green and acceptance evidence

The restricted-role regression first failed against the unchanged accepted DB:
name became `After timezone patch` and version became 2, but timezone remained
`Asia/Bangkok` instead of the requested `America/New_York`. After the additive
patch, all ten grouped timezone checks passed using real restricted app/auth
connections and synthetic issuer identities, with direct database readback.

| Acceptance | Observed evidence |
| --- | --- |
| Actual restricted role | `current_user = ourhoomu_core_app`; no owner connection in timezone regression |
| Valid owner update | Before: name `Before timezone patch`, zone `Asia/Bangkok`, version 1; after: name `After timezone patch`, zone `America/New_York`, version 2 |
| Exact retry | Same resource locator, `replayed=true`, version remains 2 |
| Different retry body | `idempotency_conflict`; all house fields unchanged |
| Invalid input | Unknown, empty, null and absent timezone return `validation_error`; name/timezone/version unchanged |
| Stale version | `version_conflict`; all house fields unchanged |
| Nonowner | `forbidden`; all house fields unchanged |
| Removed owner | Both cached retry and fresh update return existing `not_found`; surviving owner reads unchanged house fields |
| Saved schedules | Full revision and occurrence rows identical before/after house patch; later generation from old rule keeps Bangkok zone and original local-date sequence |
| New rules | Old-zone rule rejected; new rule stores current `America/New_York` house zone |

One harness correction was needed: removed membership intentionally returns
`not_found`, rather than the initial test's assumed `forbidden`. The first full
race run also exposed an old raw `house.update` replay fixture without timezone;
adding the now-required field restored the existing race scenarios. Both retry
causes were test-fixture corrections, not changes to authority or lock semantics.

## Guarded target, migration and rollback

Only the authorized synthetic Neon target was used:
project `lucky-bar-14515304`, branch `br-weathered-thunder-b38dgxbm`, endpoint
`ep-dry-breeze-b3e8t69s`. Existing `loadTarget()` guards checked the private env
and authoritative branch receipt before SQL. Credential contents were never
printed or committed. The linked production target was not used.

Migration SQL SHA-256:
`50a54045bd69fdeb9695a95b8cd3f2b3ea168987354a922f1f2e9023c4c78f54`.

The migration returns without changes on exact reapplication and rejects an
unexpected prior update statement. The owner-only migration check reconstructs
the old function definition inside a transaction, applies the additive patch
twice, verifies the exact function definition plus OID, owner, ACL, security
configuration, role IDs and probe namespace identity, and rolls back to a
savepoint to prove restoration of the old definition. Final transaction rollback
restores the accepted patched definition. A deliberately unexpected function
body is rejected and rolled back. All three grouped migration checks passed.

This rehearsal never drops schemas or rewrites table data. Rolling back the
application commit alone would not undo already-applied SQL or restore a
house's former timezone; any persistent inverse migration must be reviewed
separately. The existing `migrate.ts rollback` drops core and is unsuitable for
this patch or accepted data. Saved schedules are explicit snapshots and were
not rewritten. No persistent inverse migration or production rollback was run.

## Reproduction and final checks

From repository root:

```sh
bun install --frozen-lockfile
cd ourhoomu-api
export SYNTHETIC_DB_ENV_FILE=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env
export NEON_BRANCH_RECEIPT=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json
bun scripts/db/migrate.ts patch-house-timezone
bun scripts/db/check-house-timezone-migration.ts
bun scripts/db/check-house-timezone.ts
bun scripts/db/check.ts
bun scripts/db/check-sessions.ts
bun scripts/db/check-session-races.ts
bun run typecheck
bun run test
bun run format:check
bun run lint
bunx drizzle-kit check
bunx drizzle-kit generate
git diff --check
```

Bun 1.4.3, Node 24.15.0. The final DB run tested the exact source tree committed
as `2a14613`; no executable source changed between that run and the commit.
API package checks were also rerun on that commit. Results:

| Check | Result |
| --- | --- |
| Migration safety | 3 grouped checks, exit 0 |
| Restricted timezone parity | 10 grouped checks, exit 0 |
| Core synthetic suite | 21 checks, exit 0; runtime_probe untouched |
| Session suite | 4 groups, exit 0 |
| Session race suite | All 20 groups passed, exit 0 |
| API unit suite | 67 passed, 0 failed, 6 files |
| API typecheck / format / lint | Passed |
| Drizzle check / generate | Passed; 21 tables, nothing to migrate |
| Git whitespace | Passed |

Durable raw logs (red reproduction, final migration/timezone/core/session/race
runs and earlier attempts) are archived mode 600 under
`/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/SW-0054/`.
The final logs are named `sw0054-final-<script>.log`.

## Runtime, Graft and handoff

The dispatched session has `approval_policy=never` and
`sandbox_mode=danger-full-access`; local process inspection also observed Codex
launches with `--dangerously-bypass-approvals-and-sandbox`. No nested workers
were launched. Orca's live dispatch receipt identifies this exact worktree and
inherited provider model, with no requested model override.

🌱 Graft: ACTIVE — exact checkout
`/Users/afe/orca/workspaces/ourhoomu/sw-0054-timezone`; Graft 0.21.1.
`graft map`, `graft ask 'house timezone patch functions and database tests' --source`,
`graft grep 'house.update'`, skeleton and callers queries provided orientation
and callers before edits. Initial map reported 71 indexed files / 342 symbols /
892 edges; later queries refreshed changed files. `graft check` returned
`graph check: OK` after implementation, including both new scripts. SQL,
Markdown and private target metadata used raw-file fallback because they are
not indexed; migration script skeleton returned no indexed definitions, so
that file was read directly. No graph/cache is included in the commits.
Five retained tool output lines report estimated savings totaling 156,355
tokens; this is a captured subtotal, not a claim for other compressed outputs.

DB-window release readiness: **ready**. Final DB scripts exited successfully
and their pools/clients closed; no DB command remains running in this dispatch.
The synthetic schema remains patched, with synthetic fixtures retained for the
Lead and independent reviewer. This worker made no merge, cleanup, external
deploy, provider/native call or production change. Next owner: Lead for
independent review, local integration, DB-window coordination and worker release.
