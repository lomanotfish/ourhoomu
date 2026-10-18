# SW-0056 — Focused Turborepo review corrections

Date: 2026-10-15. Worker: platform-engineer, task `task_963c1077f204`,
Dispatch `ctx_cfa9dbddd069`. Starting SHA: `0fb8c7e18617f38d5a329010f71dfc6e54b9597a`
(Lead correction assignment on review `d28e840`). This report covers R1, R2 and
ordinary API unit discovery only; independent recheck and integration belong to
Tech Lead.

## Changes and rationale

- Removed `EXPO_NO_DOTENV=1` from web/iOS export scripts. Standard Expo
  production dotenv loading is restored without Bun wrappers or bunfig changes.
- Both Turbo export tasks explicitly include `$TURBO_DEFAULT$`, `.env` and
  `.env.*`. Explicit globs include ignored app dotenv files; existing hashed
  and passed `NODE_ENV` / `EXPO_PUBLIC_*` inputs remain intact.
- Added `expo export --clear`: the first synthetic probe proved that removing
  the disabling flag and adding Turbo inputs alone was insufficient. Changing
  the public value produced Turbo MISS `6d0b4982579bfe1d`, but Metro reused the
  previous sentinel in the JS bundle. Clearing transforms when an export
  actually executes fixes that measured stale-output case; a Turbo HIT still
  restores cached outputs without running Metro. Cold exports cost more time.
- Restored `bun test tests` for API units. Non-test-named fixture scripts are
  not discovered, and the ordinary three test files still yield 63 passing tests.
- Updated repository-specific AGENTS setup/ownership text and active Neon local
  install guidance to root `bun install --frozen-lockfile`. Historical Neon
  command evidence, credential restrictions and production gates are preserved;
  no TeamAI-managed text was changed. Root/frontend READMEs explain actual
  dotenv precedence, hashing and Metro clearing.

Official references: [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
(documentation includes newer SDK behavior, so installed SDK 57 was measured)
and [Turbo environment inputs](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables).

## Fresh checks

Runtime: Bun `1.4.3`, Node `v24.15.0`, pinned Turbo `2.11.8`. Commands run at
this isolated worktree root unless specified. No real dotenv files were read.

```sh
bun install --frozen-lockfile
bunx turbo run test typecheck typecheck:e2e format:check lint --filter=ourhoomu-front --filter=@ourhoomu/api --force
python3 /tmp/sw0056-corrections-env-proof.py
bunx turbo run export:web export:ios --filter=ourhoomu-front --summarize
bunx turbo run format:check --filter=ourhoomu-front --filter=@ourhoomu/api --force
git diff --check
graft check
```

- Frozen install: exit 0; 696 installs across 798 packages, no changes; lock
  unchanged. `/tmp/sw0056-corrections-install.log`.
- Focused regression: exit 0, 9/9 successful, zero cached; API **63 pass / 0
  fail**, frontend **53 pass / 0 fail**, app/E2E types, API lint/format and
  frontend format, plus shared contract build check.
  `/tmp/sw0056-corrections-checks.log`.
- Final clean web/iOS exports after fixture removal: exit 0, 3/3 successful;
  `/tmp/sw0056-corrections-clean-exports.log`.
- Final formatting after removing fixtures: exit 0, 3/3 successful;
  `/tmp/sw0056-corrections-format-clean.log`. An extra formatting run during
  the probe failed solely on the disposable unformatted route; preserved as
  `/tmp/sw0056-corrections-format-final.log`, then resolved by removing that
  route and running the clean check above.
- `git diff --check`: exit 0. Referenced local paths exist; reviewed Markdown
  source, code fences and links; no Markdown rendering tool was run.

## Synthetic dotenv/cache proof

Reproducer: `/tmp/sw0056-corrections-env-proof.py`; exact argv, hashes and
assertions: `/tmp/sw0056-corrections-env-results.json`; combined output:
`/tmp/sw0056-corrections-env-proof.log`. All final assertions pass. The script
refuses to overwrite existing fixtures, uses only synthetic public sentinels,
sets `NODE_ENV=production`, and removes every fixture in `finally`.

It creates a temporary `app/sw0056-env-proof.tsx` rendering the static dotted
reference `process.env.EXPO_PUBLIC_SW0056_PROBE`, plus app `.env`, `.env.local`,
`.env.production` and `.env.production.local`. `git check-ignore` confirms all
four dotenv paths are ignored. Before each actual export it uses the unchanged
fixture route so output differences cannot be attributed to source edits.

For each dotenv file, a comment-only mutation changed **both** web/iOS hashes;
the dry JSON explicitly listed the file under task inputs. Commands:

```sh
bunx turbo run export:web export:ios --filter=ourhoomu-front --dry=json
bunx turbo run export:web --filter=ourhoomu-front --summarize
bunx turbo run export:ios --filter=ourhoomu-front --summarize
```

The initial four-file setup selects production-local over local, production
and base. Its unchanged web dry-run then reports HIT. Changing production-local
selects the new value and produces a different hash and bundle. Removing
production-local and local selects production over base. An explicit caller
`EXPO_PUBLIC_SW0056_PROBE=SW0056_CALLER_OVERRIDE` overrides the files and changes
the task hash again. Each actual export below was MISS, exit 0, and its expected
sentinel was found in generated JS/Hermes bytes:

| Export scenario | Task hash | Expected synthetic value |
|---|---|---|
| web: production-local-a | `52cb4b5d7b325d0b` | `SW0056__ENV_PRODUCTION_LOCAL` |
| web: production-local-b | `c3132ddbf3432bde` | `SW0056_LOCAL_CHANGED` |
| ios: ios-production-local | `e1038f77d56006a5` | `SW0056_LOCAL_CHANGED` |
| web: production-fallback | `37ca5f52f7bf8631` | `SW0056__ENV_PRODUCTION` |
| web: caller-override | `3f6c65e62a8f3195` | `SW0056_CALLER_OVERRIDE` |

Individual logs: `/tmp/sw0056-corrections-production-local-a.log`,
`-production-local-b.log`, `-ios-production-local.log`,
`-production-fallback.log`, `-caller-override.log` (same prefix throughout).
Hash logs use `/tmp/sw0056-corrections-hash-*.log`; unchanged HIT is recorded in
`/tmp/sw0056-corrections-unchanged-cache.log`. All fixtures are removed and
final clean exports replace the synthetic generated output. A byte scan of all
final web/iOS files confirms no `SW0056_` sentinel remains. No fixture is committed.

## Runtime, Graft and boundaries

Session effective permissions are `approval_policy=never` and
`sandbox_mode=danger-full-access`; actual worker PID 83252 argv contained
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`.

🌱 Graft: **ACTIVE** — exact worktree
`/Users/afe/orca/workspaces/ourhoomu/sw-0056-turborepo`; `graft --version` =
0.21.1; `graft grep EXPO_NO_DOTENV` searched 57 indexed files with no hits.
Named JSON/Markdown config/docs used raw reads because the relevant content is
not indexed. A `graft check` during the disposable route reported STALE;
post-removal `graft check` exits 0, wiring graph in sync (305 nodes; meaning
layer pending, no deep build required). No retrieval savings figure was emitted
and no token savings are claimed.

No ticket/board/checklist updates, new workers/worktrees, DB/provider commands,
remote cache, deployment, merge or cleanup were performed. The previously
accepted E2E24, Workers dry-run and no-DB runtime evidence was not repeated:
these corrections affect dotenv export config, unit discovery and setup text.
Native/provider/production acceptance remains outside this proof. Broader
migration and independent approval are not claimed; Lead owns recheck and merge.
