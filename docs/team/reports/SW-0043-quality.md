# SW-0043 — API package quality hooks

Date: 2026-10-13 (Asia/Bangkok). Worker result: **ready for Lead review/integration**.

## Scope and provenance

- Platform-engineer Dispatch `ctx_52d54f62822c`, Task `task_8d14cc2b1e0b`.
- Exact isolated worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0043-api-quality`;
  branch `witchagorn/sw-0043-api-quality`; clean baseline
  `a22b701b14e08f37b99771f1be89df6d43723134`. Integration target is `local`;
  the Lead owns review, merge, status and cleanup.
- Read AGENTS, requirements, board, approved core implementation, SW-0043,
  agent guide, SW-0038 runtime proof and SW-0041 final review before editing.
- Session instructions supply `approval_policy=never` and
  `sandbox_mode=danger-full-access`; no independent launch-argv claim is made.
- No nested agents, user questions, root/frontend/CI/domain/schema/contract edits,
  DB connection or writes, credential reads, Neon setup, provider/native actions,
  remote deploy or push.

## Delivered diff

Pinned `@biomejs/biome` **2.5.15** as one development tool in the API manifest
and Bun lock. Added `format`, `format:check` and `lint` scripts, plus package-local
`biome.json`: two spaces, single quotes, 100-column width, built-in recommended
lint rules, warnings treated as failures, import assists disabled. The explicit
file allowlist covers API `src/**/*.ts`, `scripts/**/*.ts`, `tests/**/*.ts`,
`package.json` and `biome.json`; generated output, locks, SQL, Markdown,
Wrangler/TypeScript runtime configuration and other packages are excluded.
README documents installation, checks, formatting and the existing test runner.

Eight TypeScript files were formatted:

- `scripts/runtime-check.ts`
- `src/app.ts`
- `tests/fixtures/check-neon-runtime.ts`
- `tests/fixtures/prepare-neon-runtime.ts`
- `tests/fixtures/synthetic-target.ts`
- `tests/fixtures/worker.ts`
- `tests/runtime-target.test.ts`
- `tests/runtime.test.ts`

The initial strict lint run exited 1 on exactly two unused bindings. Removed
unused `request` destructuring from the production `onRequest` hook and unused
`error` binding from the fixture catch clause; all catch/error responses remain.
No rule suppression, guard change, fixture SQL change, dependency upgrade,
test removal or production import-graph change was introduced.

## Sources and compatibility

Checked official primary documentation and npm registry on this run:

- [Biome quick start](https://biomejs.dev/installation/quick-start/) supports
  Bun and exact development-dependency pinning.
- [Biome configuration](https://biomejs.dev/reference/configuration/) documents
  file includes, formatter options, lint presets and disabling assists.
- [Official npm package metadata](https://registry.npmjs.org/@biomejs/biome/latest):
  `npm view @biomejs/biome version engines --json` returned latest `2.5.15` and
  Node `>=14.21.3`. The web renderer could not parse the registry JSON; the npm
  registry command supplied the observed values instead.

Actual toolchain: Bun **1.4.3**, Node **24.15.0**, Biome **2.5.15**,
TypeScript **7.0.2**, Wrangler **4.150.0**. Existing application/runtime pins
remain unchanged.

## Verification evidence

Package commands ran inside `ourhoomu-api/`; Git/Graft ran in the exact worktree.

| Command/check | Actual result |
|---|---|
| `bun add --dev --exact @biomejs/biome@2.5.15` | exit 0; only Biome and its platform binaries added to the lock |
| `bun run format` | exit 0; 12 files checked, eight formatted |
| `bun install --frozen-lockfile` | exit 0; 63 installs across 145 packages, no changes |
| `bun run format:check` | exit 0; 12 files, no changes |
| `bun run lint` | exit 0; 12 files, no warnings/errors, no changes |
| `bun run typecheck` | exit 0 |
| `bun run test` | exit 0; existing six tests, zero failures, 15 expectations across two files |
| `WRANGLER_SEND_METRICS=false bunx wrangler dev --local --config wrangler.jsonc --ip 127.0.0.1 --port 18843` | actual workerd ready on loopback; only APP_ENV/ALLOWED_ORIGIN bindings |
| `RUNTIME_BASE_URL=http://127.0.0.1:18843 bun run check:runtime` | exit 0; health200, proof-route404, unknown-route404, CORS204 |
| `WRANGLER_SEND_METRICS=false bunx wrangler deploy --dry-run --config wrangler.jsonc --outdir /tmp/sw0043-api-quality-dryrun` | exit 0; 846.80 KiB / gzip156.07 KiB, dry-run only |
| Wrangler `x` shutdown and `lsof -nP -iTCP:18843 -sTCP:LISTEN` | server process exited 0; no listener remained (lsof exit1, empty) |
| `test ! -e .dev.vars` | exit 0; no private vars created |
| `git diff --check` | exit 0 |

An ephemeral, assert-based `bun -` verification took each of the eight changed
TypeScript files from `git show HEAD:<path>`, applied only the two explicit
binding removals above, and ran the pinned `biome format --stdin-file-path`
over that baseline. Every result exactly matched the current source. The same
check confirmed every pre-existing lock package entry remained byte-equivalent
as parsed data, and the generated production bundle lacked `bun:test`,
`runtime_probe`, `runtime-fixture-only`, `MIGRATION_DATABASE_URL` and
`/runtime/validate` markers. Combined with unchanged production imports and the
live workerd checks, this preserves the production/fixture boundary.

An optional earlier AST comparison did not run: TypeScript7's installed package
does not expose the legacy `ScriptTarget` compiler API. It failed before any
comparison; the successful pinned-formatter comparison replaced that proof.
No source change or extra dependency was made to accommodate that optional check.

## Graft checkpoints and limits

**Graft: ACTIVE** — CLI **0.21.1**, exact SW-0043 worktree. Initial `graft map`
copied the main checkout cache; scoped retrieval and subsequent explicit
`graft build --no-gitignore --no-ignore` verified this worktree's 36 indexed
files, 130 nodes and 336 edges. `git check-ignore graft` confirmed cache exclusion.
Docs/config/package metadata used raw fallback because they are not indexed.

`graft callers createApp --depth all` located the production entry and existing
tests before edits; scoped grep/skeleton queries located the lint bindings and
runtime check. A post-format `graft check` initially reported stale cards;
`graft grep 'RUNTIME_BASE_URL|bun:' --in ourhoomu-api/` refreshed eight changed
files, and final `graft check` passed. Deep meaning summaries were not requested.
Nine retrieval calls reported estimates totalling **51,450 tokens saved**;
no savings are inferred for build/check commands.

Acceptance evidence for this bounded quality slice is complete. Independent
review, integrated checks and full SW-0003 acceptance remain with the Lead;
the final domain contract is a separate dependency. Neon transaction/RLS and
fixture setup were deliberately not repeated: the changed fixture files match
formatted accepted source plus an unused catch binding removal. The retained
SW-0038/SW-0041 reports carry that prior evidence and its limits; this report
does not claim fresh database, remote production, live identity or native proof.

## Lead recovery/review — 2026-10-14

Original writer stopped at usage limit before commit/worker_done; report preserved in ignored durable audit store. Replacement Dispatchctx_7a032043d77b twice returned `Selected model is at capacity` before making any edits; positively observed final error turns, stopped/released, archive unavailable. Lead took exclusive ownership of this isolated worktree after both writers were fenced. No worker success is claimed.

Lead independently reviewed original worker diff/config/docs and repeated frozen install, format, lint, typecheck and six tests/15 assertions, all exit0. Lead independently compared all eight changed TypeScript files against pinned formatting of baseline plus exactly two unused-binding removals; identical. All pre-existing parsed lock package entries unchanged. Runtime fixture/guard behavior is preserved. Prior actual workerd/dry-run evidence remains from original writer; fresh integrated smoke follows merge. No application logic added by recovery.
