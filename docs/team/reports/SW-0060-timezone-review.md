# SW-0060 — independent house timezone security review

Date: 2026-10-15. Reviewer: dispatched security-engineer, task
`task_83df4682c0f7`, dispatch `ctx_6417e500064f`.

## Verdict

**approve** — no blocking findings or other actionable defects found in the
reviewed SW-0054 change. Severity counts: critical 0, high 0, medium 0, low 0.
This is independent approval of the frozen component for local/dev integration;
the Lead retains integration, ticket acceptance and cleanup ownership.

Reviewed source: `e6bdf8a8342fe80bb879b64f085db275ad353abb` (implementation
`2a14613cff44092a9c9cffe416f267d471fd5ce2`), against base
`1864cc584baf64f28b60c504e4ecb3ddc6605648`. The exact checkout was
`/Users/afe/orca/workspaces/ourhoomu/sw-0060-timezone-review`, branch
`witchagorn/sw-0060-timezone-review`; intended integration target is `local`.
All fresh executable checks below ran with that source unchanged. Only this
report is added by the reviewer; no application, SQL, test or status edits.

## Review coverage and conclusions

The entire nine-file `git diff 1864cc5..e6bdf8a` was reviewed, including both new
regression scripts, runner, journal, typed command, session-race fixture, README
and author report. Connected `0001_core_operations.sql`, database transaction
wrapper and target guard were inspected against AGENTS, requirements, board,
SW-0054/SW-0060, approved core/domain/API/OpenAPI and agent-guide instructions.

| Boundary | Review and fresh evidence |
| --- | --- |
| Required input parity | OpenAPI `HousePatch` requires name/timezone/expectedVersion; `Commands['house.update'] = Versioned & HouseCreate` now matches. No DTO or API contract change. |
| Timezone validation | The patch uses the same qualified `pg_catalog.pg_timezone_names` equality rule as house creation. Valid `America/New_York` persists; unknown, empty, null and missing zones fail with `validation_error`, leaving all three house fields unchanged. Accepted timezone names follow the existing PostgreSQL catalog rule. |
| Atomic versioned write | Existing `core.expect_version` precedes the added validation and single name/timezone/version UPDATE. A valid write increments version once; stale writes preserve all fields. Transaction rollback covers failures. |
| Membership, owner and replay | `require_member` serializes on the house and checks active membership; owner authorization precedes idempotency lookup. Exact retry returns the same locator without another increment; changed request hash conflicts. Nonowner, removed-owner fresh writes and removed-owner cached retries cannot mutate or retrieve a successful cached result. |
| Session-family lock order | The existing user/house scope lock, family-root SHARE lock and fresh `core.actor()` check remain before replay and mutation. `session.revoke` retains its UPDATE gate. No lock statement moved; only the raw race fixture gained its required timezone. Fresh deterministic races include house.update and cached replay after revocation. |
| Migration boundary | `0000`/`0001` are unchanged. `0002` replaces exactly one expected old UPDATE, refuses an unexpected prior statement and returns on exact reapplication. Its dynamic DDL comes from the database function definition and fixed migration strings, never request data. The existing function's OID, owner, ACL, SECURITY DEFINER flag and qualified search path survive. |
| Runner/target safety | Explicit `loadTarget()` checks the existing private env, exact receipt/project/branch/endpoint, expiry and roles. The patch branch neither resets schema nor regenerates credentials. Fresh runner reapply succeeds; `up` on this existing schema refuses with exit 1 and no state change. The journal registers 0002 after 0001 for empty-schema `up`. |
| Saved schedule semantics | Full saved revision/occurrence rows compare equal before/after the house patch. Later generation from the old rule retains Bangkok timezone and local dates 2026-10-20/21/22. A new rule using the old zone fails; a new New York rule saves the current house zone. SQL generation uses the saved revision zone; house-local today remains the existing request boundary. |
| Restricted roles | Fresh actual app/auth connections confirm separate command EXECUTE grants and no direct house UPDATE privilege. Writer remains NOLOGIN and all three core roles remain nonsuperuser, without BYPASSRLS/CREATEDB/CREATEROLE. |

## Fresh verification

Bun `1.4.3`, Node `24.15.0`; frozen install checked 707 installs across 855
packages without changes. Database scripts ran sequentially in the exclusively
assigned synthetic window. These are real handlers at the database command
layer and actual restricted connections with synthetic issuer identities;
they do not claim HTTP, live issuer, native or provider acceptance.

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` (root) | Exit 0; no dependency changes |
| `bun scripts/db/check-house-timezone-migration.ts` (API) | Exit 0; 3 migration safety groups |
| `bun scripts/db/check-house-timezone.ts` (API) | Exit 0; 10 restricted-role groups |
| `bun scripts/db/check.ts` (API) | Exit 0; 21 core checks |
| `bun scripts/db/check-sessions.ts` (API) | Exit 0; 4 session groups |
| `bun scripts/db/check-session-races.ts` (API) | Exit 0; all 20 deterministic race groups |
| `bun run typecheck` (API) | Exit 0 |
| `bun run test` (API) | Exit 0; 67 passed, 0 failed, 110 assertions, 6 files |
| `bun run format:check` / `bun run lint` (API) | Exit 0; 30 files each, no fixes |
| `bunx drizzle-kit check` / `bunx drizzle-kit generate` (API) | Exit 0; 21 tables, no schema changes/nothing to migrate |
| `bun run --cwd packages/contracts check:generated` (root) | Exit 0; DTO output matches OpenAPI |
| `git diff --check` | Exit 0 |

Database commands used only these explicit variables, from `ourhoomu-api/`:

```sh
export SYNTHETIC_DB_ENV_FILE=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env
export NEON_BRANCH_RECEIPT=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json
bun scripts/db/check-house-timezone-migration.ts
bun scripts/db/check-house-timezone.ts
bun scripts/db/check.ts
bun scripts/db/check-sessions.ts
bun scripts/db/check-session-races.ts
```

The guarded target was project `lucky-bar-14515304`, branch
`br-weathered-thunder-b38dgxbm`, endpoint `ep-dry-breeze-b3e8t69s`.
No reset, production connection, new branch, provider call or deployment occurred.

Additional inline `bun -e` assertions used `loadTarget()`, owner/app/auth Pools,
and `spawnSync('bun', ['scripts/db/migrate.ts', mode])` for both modes below.
They compared full before/after catalog snapshots of the command definition
hash/OID/owner/ACL/configuration, role identities/attributes, core and probe
namespace identities, and core/probe relation OIDs/ACLs (plus core RLS flags).

- `patch-house-timezone`: exit 0; snapshot identical. SQL SHA-256
  `50a54045bd69fdeb9695a95b8cd3f2b3ea168987354a922f1f2e9023c4c78f54`.
- `up`: expected exit 1, `Core schema exists; refusing unreviewed overwrite/reset`;
  snapshot identical. This is a successful refusal assertion, not a failed check.
- `current_user` app: `ourhoomu_core_app`; command EXECUTE true, auth EXECUTE false,
  direct house UPDATE false. Auth: `ourhoomu_core_auth`; command EXECUTE false,
  auth EXECUTE true, direct house UPDATE false.

Observed command OID `61295`, owner/writer OID `41645`, app OID `41647`, auth OID
`41649`, core namespace OID `60555`, probe namespace OID `24576`.
Command definition MD5 `b61aa20ebb6398e31b96ea08b8eb5777`; SECURITY DEFINER true,
configuration `search_path=pg_catalog`, ACL
`{ourhoomu_core_writer=X/ourhoomu_core_writer,ourhoomu_core_app=X/ourhoomu_core_writer}`.

Migration safety independently reconstructed the old statement inside a
transaction, patched twice, compared exact function/security/role/probe state,
rolled back to the old-definition savepoint, then rolled back the transaction
to restore the accepted patched function. An unexpected version+2 source was
rejected and rolled back. No persistent inverse migration was executed.

Raw logs are retained mode 600 outside the worktree at
`/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/SW-0060/`:
`migration.log`, `check-house-timezone.log`, `check.log`, `check-sessions.log`,
`check-session-races.log`, `role-runner-identity.log`, `typecheck.log`, `test.log`,
`format-check.log`, `lint.log`, `drizzle-check.log`, `drizzle-generate.log`.
The author's earlier logs remain under the adjacent `SW-0054/` directory.

## Limits, runtime and handoff

Fresh empty-schema `up` was reviewed statically rather than executed: resetting
the accepted schema was outside this window's authorization. Rehearsed rollback
proves transactional DDL restoration; reverting Git alone does not undo an
already-applied patch or historical house timezone writes. The destructive
core-schema `rollback` command is not a patch rollback and was not run.
Provider/native/production, retention purge and complete HTTP/API integration
remain outside this component's acceptance.

Observed process PID `95478` was
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`, matching session
`approval_policy=never`, `sandbox_mode=danger-full-access`; no model override or
nested worker was requested. Orca executable `/usr/local/bin/orca`; live inbox
checks confirmed this task/dispatch. No merge, worktree cleanup or status change.

🌱 Graft: **ACTIVE** — Graft `0.21.1` in the exact checkout above.
`graft build --no-gitignore --no-ignore` indexed 73 files; initial
`graft ask 'house update command timezone migration session lock schedule revision' --source -n 6`
found the changed scripts and command type. Skeleton/callers, `graft grep 'house.update'`
and a transaction-wrapper query inspected connected code. Final `graft check`:
`graph check: OK`. SQL, Markdown, journal/config and private target metadata used
raw fallback as unindexed resources; migrate.ts skeleton returned no indexed
definitions, so the runner was read directly. Six figure-reporting retrieval
outputs total **59,667 estimated tokens saved**; one additional retrieval
reported no definitions/no savings. No graph/cache is committed.

**DB window released by this reviewer:** all DB scripts and runner children
exited, their finally blocks closed pools, and the additional owner/app/auth
probe explicitly logged `POOLS_CLOSED owner/app/auth`. No DB work remains active
or planned by this dispatch. The accepted patched schema and synthetic fixtures
remain intact; Lead may reassign the window. Next action is Lead acceptance and
local integration, with integration checks and Orca release/cleanup owned by Lead.
