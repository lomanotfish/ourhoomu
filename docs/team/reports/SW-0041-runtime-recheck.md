# SW-0041 — focused runtime recheck

Date: 2026-10-13 (Asia/Bangkok). Verdict: **changes_requested**.

What this change does: frozen `38d9c593a96a639d4ad4a0c70b346050ab465adb` removes the validation fixture from the production app, returns fixed public errors, and introduces a shared synthetic Neon URL guard. The first two original findings are resolved. The third remains open because the guard and the pinned database driver interpret query parameters differently.

## Scope and provenance

- Reviewed the three findings in `docs/team/reports/SW-0041-runtime-review.md` from `63c8a06`, plus their correction in frozen `38d9c59`.
- Exact worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0041-runtime-review`; branch: `witchagorn/sw-0041-runtime-review`.
- `git merge --ff-only witchagorn/sw-0038-runtime` exited 128 because the original report commit caused divergence. Per Dispatch authorization, `git cherry-pick 38d9c59` succeeded as `60ca77a` on `63c8a06`. `git diff 38d9c59 HEAD -- ourhoomu-api` was empty before writing this report. The reviewer made no source edits; only this report is authored in this Dispatch.
- Read project AGENTS, requirements, board, agent guide, the assigned SW-0041 ticket at `/Users/afe/Desktop/ourhoomu/docs/team/tickets/SW-0041.md`, SW-0038 scope, API envelope, Graft skill and `software-tech-lead/references/agent-runtime.md`. The current Dispatch authorizes this new report and supersedes the older ticket's frozen input/report path.
- Effective permissions are supplied by this session as `approval_policy=never`, `sandbox_mode=danger-full-access`. The shell's parent process, PID 25781, was observed as `codex --no-daemon --dangerously-bypass-approvals-and-sandbox`. This does not expand review ownership or external authorization.

## Must fix

1. **P1 — Query parameters bypass the synthetic endpoint and secure-mode guard.**

   **What this is:** `ourhoomu-api/tests/fixtures/synthetic-target.ts:5-14` validates WHATWG URL hostname and the first `sslmode` value, then the caller passes the unchanged connection string to the Neon driver. Preparation calls it before creating the write-capable owner Pool (`tests/fixtures/prepare-neon-runtime.ts:33-41`); the check script uses it before its network requests and Pools (`tests/fixtures/check-neon-runtime.ts:43-44`, `:77-78`).

   **Problem:** An otherwise valid owner URL with `&host=ep-example-a1-attacker.c-4.ap-southeast-1.aws.neon.tech` passes the guard, but `new Client({ connectionString: value }).connectionParameters.host` is the attacker-prefix host. `&host=evil.example` also passes and becomes the driver's effective host. Separately, `?sslmode=require&sslmode=disable` passes the guard while the driver parses `connectionParameters.ssl` as `false`. This was reproduced using the pinned `@neondatabase/serverless` 1.2.0 constructor without `connect`, `query`, or any network call. Its local bundled parser preserves a query `host` ahead of URL hostname and takes the last duplicate query value (`node_modules/@neondatabase/serverless/index.mjs:748-763`).

   **Fix:** Reject connection-target overrides and ambiguous query parameters before handing the string to Pool; use an explicit allowed query-key set with exactly one secure `sslmode`. Add regressions for both query-host overrides and duplicate secure/insecure `sslmode` values. Alternatively, validate and pass exactly the same normalized driver configuration rather than validating one interpretation and using another.

   **If we skip it:** The preparation guard can approve owner credentials for a different effective endpoint, violating the synthetic-only boundary before write-capable setup. The claimed secure-mode check can also approve a URL whose PostgreSQL SSL option is disabled. No actual credential disclosure, alternate-host connection, or DB write was attempted. Disabled PostgreSQL SSL parsing alone does not prove plaintext transport: the Neon driver's WebSocket transport has a separate TLS setting.

### Reproducible no-network evidence

Run from `ourhoomu-api/` after frozen installation. All credentials and host names below are synthetic placeholders; constructing Client does not connect.

```sh
bun - <<'JS'
import { Client } from '@neondatabase/serverless';
import { assertSyntheticDbUrl } from './tests/fixtures/synthetic-target.ts';
const endpoint = 'ep-example-a1';
const host = `${endpoint}.c-4.ap-southeast-1.aws.neon.tech`;
const base = `postgresql://neondb_owner:placeholder@${host}/neondb?sslmode=require`;
for (const [name, value] of [
  ['prefix query host', base + `&host=${endpoint}-attacker.c-4.ap-southeast-1.aws.neon.tech`],
  ['other query host', base + '&host=evil.example'],
  ['duplicate sslmode', base + '&sslmode=disable'],
]) {
  assertSyntheticDbUrl(value, endpoint, 'neondb_owner');
  const client = new Client({ connectionString: value });
  console.log({ name, guardAccepted: true,
    driverHost: client.connectionParameters.host,
    driverSsl: client.connectionParameters.ssl });
}
JS
```

Observed: all three guards accepted; effective hosts were respectively `ep-example-a1-attacker.c-4.ap-southeast-1.aws.neon.tech`, `evil.example`, and the original host. The third case reported `driverSsl: false`; the first two reported `{}`. Baselines `sslmode=require` and `sslmode=disable` yielded guard/driver results `true/{}` and `false/false`; reversed duplicates `disable&sslmode=require` yielded `false/{}`. A runtime URL with `&user=neondb_owner` retained driver user `ourhoomu_runtime_probe`, so that experiment did **not** demonstrate a role bypass.

## Original findings rechecked

| Original finding | Result | Evidence |
|---|---|---|
| Production validation fixture exposed | Resolved | `wrangler.jsonc:4` selects `src/index.ts`; its imports at `src/index.ts:1-6` reach only `createApp`, bindings and types. `src/app.ts:18-25` registers OPTIONS and health; the proof routes remain in the separate `tests/fixtures/worker.ts:27-45`. In production-config local workerd, GET/POST validation and POST DB actor routes all returned 404, including arbitrary Bearer auth and malformed validation JSON. |
| Missing routes returned 500; public errors exposed raw exception text | Resolved | `src/app.ts:28-37` returns fixed `not_found`/`Not found`, validation and `internal_error`/`Internal server error` messages. Local production workerd returned the exact fixed 404 envelope with a string requestId. An in-memory app whose `allowedOrigin` getter threw `PRIVATE_DRIVER_SENTINEL_0041` returned 500 with the fixed internal message, a requestId and no sentinel. Fixture catch/error branches also use fixed messages (`tests/fixtures/worker.ts:81-99`). |
| Synthetic endpoint hostname prefix accepted | Partially fixed; remains open | `synthetic-target.ts:7-16` now rejects direct hostname-prefix lookalikes, requires a Neon domain, exact endpoint/pooler first label, PostgreSQL scheme, password and expected role. However, query-host and duplicate-SSL interpretation bypasses above still undermine the effective target/security check. |

## Checks actually run

Package working directory was `ourhoomu-api/`; Git, Graft and Orca commands ran from the exact review worktree.

| Command/check | Observed result |
|---|---|
| `bun --version` | 1.4.3 |
| `bun install --frozen-lockfile` | exit 0; checked 61 installs across 136 packages; no changes |
| `bun run typecheck` | exit 0 |
| `bun run test` | exit 0; 5 pass, 0 fail, 11 expectations across 2 files |
| Independent in-memory URL/error matrix via `bun -` | exit 0; 3 valid URLs accepted, 13 invalid URLs rejected; injected-error fixed 500 confirmed |
| Independent Neon Client parser experiments via `bun -` | exit 0; effective-host overrides and duplicate-SSL mismatch reproduced without connection; role override experiment did not bypass user identity |
| `bunx wrangler dev --local --config wrangler.jsonc --ip 127.0.0.1 --port 8791 --inspector-port 9241 --persist-to /tmp/sw0041-recheck-state` | Wrangler 4.150.0 started real local workerd at 127.0.0.1:8791; listed only APP_ENV and ALLOWED_ORIGIN bindings, no DB/actor bindings |
| `RUNTIME_BASE_URL=http://127.0.0.1:8791 bun run check:runtime` | exit 0; health 200, proof route hidden 404, unknown route 404, CORS 204 |
| Independent production workerd request matrix via `bun -` | exit 0; health 200; POST validation with valid and malformed bodies, GET validation, POST DB actor a, POST DB actor b with fail query, and unknown GET all returned fixed 404 JSON with string requestId; health OPTIONS returned empty 204 and the configured origin |
| Stop local Wrangler session | Ctrl-C yielded shutdown message and process exit 0 |
| Private local binding filename check | Only `ourhoomu-api/.env.example` found; no `.dev.vars` or `.env` credential contents read |
| `git diff --check` before report | exit 0 |

The independent 16-URL matrix covered direct/pooler/verify-full acceptance and rejection of hostname/pooler prefixes, foreign suffixes, an endpoint in a later label, non-PostgreSQL schemes, missing/disabled SSL, wrong owner/runtime roles, a role prefix and missing password. The package tests pass but do not cover the newly found driver/guard mismatch. No format script is defined.

## Graft and limits

🌱 Graft: **ACTIVE** — CLI 0.21.1 in this exact worktree. `graft map` refreshed 8 changed files and indexed 36 files; `graft ask --source --in ourhoomu-api/ -n 8` located the guard and relevant app/fixture files; `graft grep 'createApp|assertSyntheticDbUrl|onError|Pool' --in ourhoomu-api/` returned 27 hits across 8 symbols. `graft check` exited 0 and reported the wiring graph in sync; the deep layer is not built. Raw reads followed these locations for complete review detail; docs/config and the installed driver's unindexed bundle were read directly. The three retrieval calls reported savings of 34,930 + 4,622 + 3,698 = **43,250 estimated tokens**; no savings were inferred for version/freshness commands.

No DB setup, live Neon transaction, DB writes, credential access, remote deploy, provider action, push, source edit, nested agent or project status update was performed. The fixed 500 was tested in Bun against the production app factory, not induced inside the frozen workerd entry, whose only data route is health. Prior Neon transaction/RLS/rollback evidence in SW-0038 was not independently rerun here. This verdict applies only to the three SW-0041 findings and the frozen correction; it does not accept full domain foundation, native login, SlipOK, LINE or release readiness.

Verdict: **fix finding 1 before integration**. Next owner: SW-0038 platform engineer via Tech Lead, followed by a focused independent recheck of the corrected guard and regressions.
