# SW-0057 — Independent Turborepo review

Verdict: **changes_requested**. Review date: 2026-10-15.

Reviewer: independent code-reviewer, task `task_0548d4361ca6`, Dispatch
`ctx_6a4bd024f42b`. Reviewed source `6a14757fcce79fadcf52d6f5593eeebbe77ba4bb`
against local baseline `e50ed8bb23a2e02371e9a5c7b8097a39c8e1f41d`, implementation
report `2fb56a5`, and Lead records through `eb26339`. Exact worktree:
`/Users/afe/orca/workspaces/ourhoomu/sw-0056-turborepo`.

## Required changes

### R1 — P2: Make dotenv handling preserve Expo behavior and match cache inputs

Locations: `ourhoomu-front/package.json:13` and `:14`, `turbo.json:51`–`:73`.

Both export scripts newly set `EXPO_NO_DOTENV=1`. This suppresses Expo's normal
production dotenv selection, although the approved migration preserves app and
tooling behavior. The installed `@expo/env` confirms this without reading any
credentials: `getFiles('production')` normally returns
`.env.production.local`, `.env.local`, `.env.production`, `.env`; with the new
flag it returns `[]`. Plain `expo export` was the baseline command. Documenting
the change in the README does not establish authorization for that behavior change.

With the Lead's explicit approval, the reviewer also ran an isolated synthetic
probe at `/tmp/sw0057-dotenv-proof-cv2fohq1`, using Bun 1.4.3 and the installed
`@expo/env` loader. Both commands used `NODE_ENV=production` and a synthetic
`.env.production`. `bun run baseline` with normal loading printed
`RESULT=SYNTHETIC_PRODUCTION`; the otherwise identical migrated command with
the new flags printed `RESULT=MISSING`; both exited 0. The two logs, probe,
manifest, and `results.json` remain in that directory. The current demo does
not read an `EXPO_PUBLIC_*` value, so existing demo E2E success does not exercise
this supported export configuration behavior.

Restore the supported Expo dotenv behavior and make every effective public build
value affect the export hash. The current cache config explicitly hashes public
parent-process environment values and excludes ignored dotenv files; therefore
do not simply remove the flag while continuing to ignore files that influence
exports. Prove that changing a synthetic public value
in an app dotenv file causes a cache miss and an updated output, including the
production-mode file precedence case. Never print real dotenv contents or values.

A separate bounded Bun/Turbo probe did **not** establish an existing stale-value
cache defect: ordinary `bun run` did not load dotenv into the Node child, whereas
explicit `--env-file` and `bun exec` did. Its artifacts are at
`/var/folders/rv/cpv7rmg523ggpqlnxgkhkf240000gn/T/sw0057-cache-proof-pf6inw4e`.
The initial automatic-inheritance hypothesis is rejected, not a review finding.

### R2 — P2: Update the remaining authoritative setup instructions

Locations: `AGENTS.md:45`, `AGENTS.md:53`, `docs/project/neon-setup.md:30`.

The migration removes `package-lock.json` and makes root `package.json` own the
Bun workspace/Turbo graph, but AGENTS still says the npm manifests contain only
Neon tooling and instructs contributors to run `npm ci`. The Neon setup guide
also still begins its local setup with `npm ci`. That command no longer has its
required lockfile, and these instructions directly conflict with the new root
README. A clean-checkout contributor following the authoritative guide cannot
complete the prescribed setup.

Replace these migration-specific instructions with the root frozen Bun install
and accurately describe workspace ownership while preserving Neon authorization
and credential restrictions. The adjacent claim in `AGENTS.md:39` that the API
has no scaffold is also obsolete; correct it as part of the narrow consistency
update. No Neon configuration or remote operation is necessary.

## Nonblocking observation

`ourhoomu-api/package.json:19` narrows `bun test tests` to two named files and
`tests/auth`. All three current unit files remain selected, so this review found
**no currently omitted test** and does not characterize it as a failing suite.
However, ordinary tests added elsewhere beneath `tests/` are no longer discovered
by the established command. The current executable fixtures are named
`prepare-neon-runtime.ts`, `check-neon-runtime.ts`, `synthetic-target.ts`, and
`worker.ts`, rather than test-file names; broad discovery already passed the
baseline's same 63 tests. Prefer preserving ordinary discovery, with a fixture
directory exclusion if needed, instead of maintaining a growing file allowlist.
This is a maintenance recommendation, not an additional merge blocker.

## Accepted design and verification

- Shared contract semantics are preserved. The new
  `packages/contracts/src/dto.ts` SHA-256 is
  `2589147bd9b4088bd16059c4beaf9e2ed94acd07bac1b6b0d96e918044769422`, exactly
  matching the baseline frontend DTO. Comparing the baseline API DTO against it
  shows only formatting of the `PaymentSummary` union, with no type change.
  Both original app import paths now use type-only re-exports.
- The canonical schema remains `docs/project/openapi.yaml`, unchanged from the
  baseline. Its SHA-256 is
  `ad02a058a7ffa7a637463d7b02e5820481103abfe4ee19c7851fee79d0d0ca4f`.
  Keeping this established schema path is acceptable: there is one schema and
  one generated DTO, rather than a duplicated package schema. The pinned
  generator reads that schema directly. Reviewer ran
  `node packages/contracts/scripts/generate.mjs --check`: exit 0, generated
  contracts match. Existing `/tmp/sw0056-generation-negative.log` records the
  generator rejecting a mismatched DTO.
- No dummy utils package is required. Current money/date helpers have only a
  frontend consumer; retaining them there avoids introducing shared business
  behavior or platform dependencies solely to populate `packages/`.
- Root private workspaces include both unchanged app paths and `packages/*`;
  both apps declare `workspace:*` contracts dependencies. Isolated installation
  and one root lock retain distinct TypeScript versions. Reviewer directly
  verified Bun `1.4.3`, Node `v24.15.0`, API TypeScript `7.0.2`, and
  frontend/contracts TypeScript `6.0.3`. Root Neon dependencies and `neon.ts`
  are retained; no Neon config diff was found.
- The saved Turbo graph is strict, links app checks/exports to
  `@ourhoomu/contracts#build`, and includes the canonical schema in contracts
  build/check inputs. Web, iOS, and Workers output directories do not overlap.
  Workers builds explicitly use `deploy --dry-run`. Runtime, generation,
  formatting writes, development, E2E, and DB fixture tasks are noncached;
  ordinary root `test` does not schedule a DB/provider command. No remote cache
  was configured or claimed.
- Reviewer compared all ten runnable tasks in
  `/tmp/sw0056-cache-before.json`, `-mutated.json`, and `-restored.json`:
  every shared-source mutation changed the hash, and removal restored it.
  This supports shared-source/schema graph correctness, separately from R1.
- Existing logs were inspected rather than repeating expensive successful
  checks: `/tmp/sw0056-fresh-install.log:7` records 688 installed packages;
  `/tmp/sw0056-frozen-install.log:3` records a later frozen install with no
  changes. `/tmp/sw0056-final-checks.log:258`–`:260` records 15/15 successful,
  zero cached, with API 63 and frontend 53 passing tests. The cache-hit log
  records 15/15 hits; `/tmp/sw0056-e2e.log:51` records 24 passed;
  `/tmp/sw0056-runtime.log:10` records the local production workerd matrix.
  Metro remains on Expo's default configuration; the successful web/iOS exports
  and Playwright Wrangler invocation support compatibility with isolated paths.
  These are existing worker results, not independently rerun full suites.
- Reviewer ran `git diff --check e50ed8b HEAD`: exit 0. This review does not
  claim DB-backed, native device, provider, production, or deployment acceptance.

## Runtime, scope, and follow-up

Graft: **ACTIVE** in the exact worktree. `graft --version` returned `0.21.1`;
`graft map` indexed 57 files / 248 symbols / 645 edges. `graft grep
'EXPO_PUBLIC|process.env|Bun.env'` returned six hits in three files. Config,
Markdown, canonical YAML, generated DTO comparison, and installed dependency
internals were read directly where the graph did not provide the needed detail.
Retained retrieval estimates are 104,596 for the map and 2,520 for the grep
(107,116 subtotal); estimates from earlier compressed outputs are not claimed.
The worker's actual Codex process argv includes
`--dangerously-bypass-approvals-and-sandbox`; session settings specify
`approval_policy=never` and `sandbox_mode=danger-full-access`.

Only this report is changed inside the Git worktree by the reviewer. The Lead
explicitly authorized disposable isolated temporary probes, described above.
No implementation fixes, status
updates, merge, cleanup, new agents, DB/provider operations, remote writes, or
access to another worktree's dirty agent-guide/untracked lock were performed.
The Tech Lead owns assigning corrections and deciding acceptance after focused
reverification. Review completion is successful; the implementation verdict is
changes_requested.
