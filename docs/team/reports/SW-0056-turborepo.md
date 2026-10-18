# SW-0056 — Bun workspace and Turborepo migration

## Delivery and boundaries

- Worker: platform-engineer, task `task_e756bf61f77e`, Dispatch `ctx_3da6ec233de5`,
  Run `run_bc557bc8a370`; coordinator `term_2ea414af-0f8d-4086-9891-3acf48666f66`.
- Exact workspace: `/Users/afe/orca/workspaces/ourhoomu/sw-0056-turborepo`;
  branch `witchagorn/sw-0056-turborepo`.
- Local integration baseline: `e50ed8bb23a2e02371e9a5c7b8097a39c8e1f41d`;
  assigned planning baseline: `960386cc8a7e2786194c98e939a76b209c530898`.
- Implementation/tested content: `6a14757fcce79fadcf52d6f5593eeebbe77ba4bb`.
  The report-only commit follows it. No ticket/board/checklist status was edited.
- No merge, worktree cleanup, production/DB/provider operation, push or deploy.
  Other checkouts, including the user's dirty agent-guide and untracked lock,
  were untouched. This worker did not dispatch other agents.

## Result

Root private Bun workspaces discover the two unchanged app directories and
`packages/*`. Bun 1.4.3, Node.js 24.15.0 and repository-local Turbo 2.11.8 are
pinned. One root `bun.lock` replaces the three superseded tracked locks;
`skills-lock.json` and root Neon dependencies are retained. The root lock hash is
`054e6396c96c1fe15d6e4f3f89fa0225281d257833588d58f625ed907cff0959` (SHA-256).

`@ourhoomu/contracts` owns one generated DTO source and pinned generation.
The authoritative shared schema stays at the documented, frozen
`docs/project/openapi.yaml` path: version `0.3.2-core-proposal`, SHA-256
`ad02a058a7ffa7a637463d7b02e5820481103abfe4ee19c7851fee79d0d0ca4f`.
Its contents were not changed. `openapi-typescript` 7.13.0 plus Prettier 3.9.10
reproduce the DTO. Both apps use `workspace:*` and retain their original DTO
import paths as type-only re-exports. There are no runtime contract exports.

Before replacing either original DTO, programmatic canonical formatting compared
the newly generated source against **both** baseline app DTO files, asserting
exact equality with Prettier 3.9.10 and the existing frontend formatter options.
Both matched. The original API/frontend files differed only in formatting.
The generated check also rejected an intentional appended DTO comment (exit 1),
then passed after restoring the exact source (exit 0).

Database/Drizzle schemas remain server-only. No artificial utility package or
runtime validation dependency was added: existing money/date helpers only have
frontend consumers. `packages/contracts/README.md` documents how to extend the
shared schema and how to add a portable utility package when two actual
consumers exist.

## Task and cache safety

- Root graph discovers `@ourhoomu/api`, `@ourhoomu/contracts`, `ourhoomu-front`.
  Both app checks/exports depend on `@ourhoomu/contracts#build`, which performs
  the read-only generation comparison. The schema is an explicit task input.
- Web and iOS output independently to `ourhoomu-front/dist/web/` and `dist/ios/`.
  Workers output is `ourhoomu-api/dist/worker/`, using `deploy --dry-run` only.
- Dev/start/web/ios are persistent and noncached. Formatting writes, generation,
  E2E/browser installation, and runtime/DB fixture commands are explicit and
  noncached. Root `test` invokes only unit suites; API uses explicit test paths
  and never discovers executable DB fixture scripts.
- Strict Turbo environment mode is retained. Build inputs include `NODE_ENV`,
  frontend `EXPO_PUBLIC_*`, CI and pinned toolchain configuration. No secret
  wildcard or secret passthrough is configured. Public variable values must
  never contain credentials. `check:runtime` passes only `RUNTIME_BASE_URL`.
- Expo exports disable dotenv loading and telemetry. Default ignored-file
  exclusion keeps `.env*`, `.dev.vars`, `.neon`, dependencies, caches and
  generated artifacts out of ordinary source hashing. No remote cache is
  configured or used; all recorded cache hits are local.
- Existing Expo SDK 57 default Metro monorepo support was sufficient; no Metro
  resolver/watch-folder customization or app directory move was necessary.
  Isolated package symlinks preserve the existing Playwright Wrangler path;
  actual HTTP acceptance confirmed it works without a config path change.

## Baseline and corrected migration failures

Baseline commands ran before modifying manifests or DTOs at planning commit
`960386c`, using original per-app frozen locks:

| Command/location | Observed result |
| --- | --- |
| `bun install --frozen-lockfile` in each app | API 64 packages; frontend 578 packages; exit 0 |
| API `bun run typecheck`, `format:check`, `lint` | All exit 0; Biome checked 15 files |
| API `bun run test` | 63 pass, 0 fail, 3 files, 90 expectations |
| Frontend `bun run typecheck`, `format:check` | Both exit 0 |
| Frontend `bun run test` | 53 pass, 0 fail, 6 files, 383 expectations |
| Frontend `bun run export:web`, then `export:ios` | Both exit 0; original `dist/` output |
| API `node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config wrangler.jsonc --outdir /tmp/sw0056-baseline-worker` | Exit 0; 846.91 KiB upload / 156.11 KiB gzip; no deployment |

No baseline failure was found in these checks. Baseline E2E/typecheck:e2e was
not independently rerun before migration; both pass after migration below.

The first combined install/checks exposed migration problems, all resolved:

1. Hoisting selected API TypeScript 7 for openapi-typescript; `ts.factory` was
   unavailable. `bunfig.toml` now selects isolated installs, preserving API
   TypeScript **7.0.2** and frontend/contracts TypeScript **6.0.3**.
2. Root Neon tooling's TypeBox 0.27.12 satisfied an accidental peer choice for
   Elysia and caused `Export named Unsafe not found`. API now explicitly
   declares its already-baseline peer TypeBox **0.34.52**; all API tests pass.
3. Isolated resolution exposed frontend reliance on transitive Node types and
   Babel preset. Explicit frontend dev dependencies use already-baseline
   `@types/node` **26.6.5** and `babel-preset-expo` **57.0.15**.
4. API tsconfig named transitive `bun-types`; it now references declared `bun`
   (`@types/bun`) directly. No compiler version or type safety flag changed.
5. Initial combined resolution advanced four ranged frontend direct packages.
   Their baseline resolutions were restored before final verification;
   `expo-constants` is pinned to **57.0.21** to prevent a repeat conflict.
   Final comparison of every existing direct app dependency against the old
   locks found **zero version mismatches** in either app.
6. Initial new generator/config formatting warnings were fixed with the pinned
   formatter. No final formatting/lint failure remains.

The combined lock re-resolves transitive ranges: 3 API and 31 frontend old
resolution entries are absent from its version set (duplicate entries counted).
These are not direct dependency upgrades. Examples include Expo CLI
57.0.29 → 57.0.30 and newer compatible Expo/Metro/Radix support packages;
React Native-related graph branches are deduplicated differently. The final
frozen graph, both exports and browser acceptance were verified. The lock is
not claimed byte-equivalent to merging the former dependency trees.

## Fresh install and final verification

Removed **only this workspace's generated** root/app/contracts `node_modules`
directories, then ran `bun install --frozen-lockfile`: exit 0, **688 packages
installed in 2.29s**. SHA-256 comparison confirmed the root lock was unchanged.
A later frozen install at committed `6a14757` checked 696 installs across 798
packages with no changes (exit 0).

The complete fresh-install validation bypassed caches:

```sh
bun run turbo run typecheck typecheck:e2e test format:check lint check:generated export:web export:ios build:worker --force --summarize
```

**15 successful / 15 total; 0 cached; exit 0 (13.182s).** This checks API,
frontend, contracts and E2E TypeScript, both unit suites, all existing formatting
checks, API lint, schema generation and the three exports. Unit totals remain
**63 API + 53 frontend**, no skipped/failing tests. Workers dry-run produced the
bundle with `APP_ENV=development` and the configured local CORS origin; it did
not upload. Web static pages and iOS Hermes JavaScript bundle (~4.8 MB) were
written to separate output directories.

`bun run test:e2e` used existing Playwright 1.64.1 and installed Chromium:
**24 passed in 35.0s**, exit 0. These are desktop/mobile **demo** browser flows
and HTTP tests against the real local production workerd entry, without DB,
identity/provider mocks or production calls. The existing server configuration
owned ports 18047–18049 and shut them down. This does not prove DB-backed app
flows, native iOS, issuer/network login, provider or TestFlight acceptance.

Dedicated additional runtime proof:

```sh
# From ourhoomu-api, in a dedicated process:
WRANGLER_SEND_METRICS=false node node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.jsonc --ip 127.0.0.1 --port 18056 --inspector-port 18057
# From the root:
RUNTIME_BASE_URL=http://127.0.0.1:18056 bun run check:runtime
```

Exit 0: health 200 with request envelope, fixture proof route hidden 404,
unknown route 404 and CORS preflight 204. Turbo reported **cache bypass**.
The worker-owned server was stopped with SIGINT after the check. `lsof` found
no listeners left on 18047–18049 or 18056–18057.

## Cache hit and shared-source invalidation proof

Repeating the full 15-task command without `--force` gave **15/15 cache hits**,
exit 0 (13ms). After committing implementation as `6a14757`, the same command
again gave **15/15 cache hits**, exit 0 (11ms), confirming committed inputs
match the successfully tested source and outputs.

A separate dry graph captured task hashes. Added a temporary, valid
`packages/contracts/src/cache-probe.ts` with `export type CacheProbe = never;`,
then ran:

```sh
bun run turbo run typecheck typecheck:e2e test export:web export:ios build:worker --summarize
```

All **10 runnable tasks** missed and succeeded (0 cached, 7.674s). The temporary
source was removed; hashes returned exactly to their originals and the same
command gave **10/10 cache hits** (28ms). No probe remains in the commit.
The table records actual runnable tasks, excluding graph-only nonexistent tasks:

| Task | Before / restored hash | Shared source added hash |
| --- | --- | --- |
| `@ourhoomu/api#build:worker` | `2e5dee47cbb2118e` | `8ac500ae3c80c4c0` |
| `@ourhoomu/api#test` | `d580c2b9b3ae48c5` | `05952f06c3130195` |
| `@ourhoomu/api#typecheck` | `4c7126a5279221b4` | `ce0b2e1a2c2c7dc3` |
| `@ourhoomu/contracts#build` | `3261c47ff7887379` | `767ea1f85a76d4fb` |
| `@ourhoomu/contracts#typecheck` | `90c8e5ace6b1d4b7` | `0727220f708717c4` |
| `ourhoomu-front#export:ios` | `28c5fa64e3bf7d1b` | `cd2a586b07529bea` |
| `ourhoomu-front#export:web` | `20ff701e4d2017dc` | `2d313c3c0444fd8b` |
| `ourhoomu-front#test` | `d5edf648583943dc` | `ddecfc73db968316` |
| `ourhoomu-front#typecheck` | `22a52ef1f56f042d` | `ab6a22744c2c9ebc` |
| `ourhoomu-front#typecheck:e2e` | `11d126f16564e663` | `801edc162afe6c7f` |

## Graft and actual runtime

🌱 **Graft: ACTIVE** — exact SW-0056 workspace above. `graft --version` returned
**0.21.1**. Initial `graft build --no-gitignore --no-ignore` built/refreshed the
exact-worktree graph (55 indexed files, 308 nodes, 647 edges). `graft map`,
`graft grep 'dto|generate'`, `graft callers components --depth all`, and
`graft grep 'process.env|EXPO_PUBLIC|Bun.env'` located the contract seams and
environment readers before edits. Ambiguous duplicated `components` produced
no call edges; grep results supplied consumers. Config/Markdown/YAML and
truncated generated spans were read directly as allowed fallback.

The first final `graft check` correctly reported stale DTO/new-package nodes.
A final `graft build --no-gitignore --no-ignore` refreshed **57 files, 305 nodes,
645 edges**, then `graft check` returned **OK**, wiring graph in sync. The deep
meaning layer was not built; no deep-layer result is claimed. `graft/` stays an
ignored local cache. Four retrieval calls reported estimated savings
144,400 + 89,180 + 79,915 + 2,520 = **316,015 tokens**; this is Graft's estimate,
not measured model billing or an independent savings calculation.

Actual parent process inspection (`ps -ww -o pid,ppid,args -p $$ -p $PPID`)
showed `codex --no-daemon --dangerously-bypass-approvals-and-sandbox`.
The session permission contract is `approval_policy=never`,
`sandbox_mode=danger-full-access`; the observed launch flag corroborates the
skip-permission configuration rather than relying only on profile defaults.
Bun returned **1.4.3**, Node **v24.15.0**. `orca orchestration worker-show
--dispatch ctx_3da6ec233de5 --json` confirmed the exact worktree and terminal,
Codex ready/input_accepted and requested/effective model/effort null (no worker
override). No local platform-engineer profile was found in the searched repo/
Codex paths; the dispatched platform-engineer role was used. Worker guides,
Graft skill and agent-runtime reference were read before implementation.

## Review, limitations and rollback

- Independent review, Lead integration checks, ticket acceptance and cleanup
  remain Lead-owned; this report does not claim them completed.
- No DB tests, production migrations/data, live provider/Neon operations,
  identity login, native build/device, TestFlight, remote cache or deployment
  were run. Existing synthetic DB commands remain gated and noncached.
- The existing formatting/lint tools retain their package-specific scope;
  there is no newly invented root CI/coverage policy.
- Revert the implementation commit using a normal reviewed Git revert if the
  Lead chooses rollback (do not reset user work). That restores former app/root
  locks, manifests, DTO locations and setup docs. Remove only confirmed generated
  workspace dependencies/cache, then reinstall with the restored package locks.
  No data rollback or remote operation is needed. Revert the report-only commit
  as appropriate; preserve this evidence before removing its worktree.

Primary documentation consulted on 2026-10-15:
[Turborepo existing repositories](https://turborepo.dev/docs/getting-started/add-to-existing-repository),
[Expo monorepos](https://docs.expo.dev/guides/monorepos/), and
[Bun workspaces](https://bun.com/docs/pm/workspaces).
Root/app/shared-package READMEs contain the migration setup and commands.
`git diff --check` passed before implementation commit and report delivery.
