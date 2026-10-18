# SW-0058 consolidation integration

## Result and ownership

Integration worker branch `witchagorn/sw-0058-consolidate`, exact worktree
`/Users/afe/orca/workspaces/ourhoomu/sw-0058-consolidate`.
Base local `843f4578f1f8b64494920a7a504217a044c9b20c` plus Lead plan `a33fbdd`.
Source result **018775434730207de6857265c66e417ee163d548**.
No local merge, acceptance/status edits, worktree cleanup, provider operations,
production operations, migration, rollback, or DB command was performed by this worker.
Lead owns local integration and the independent SW-0052 approval gate.

## Complete-history merges and conflict choices

- `7495c3a`: merges runtime review `281d1396436d978fa8f03d0da0b0735b25318d4a`.
  Eight conflicts in app, runtime checker, fixture helpers/worker and runtime tests
  retain current accepted versions. The old review fixes already exist in local;
  restoring them would regress later formatting, parser handling and CORS work.
  Production app entry, test-only route isolation and API quality tooling preserved.
- `56c5258`: merges DTO branch `b8d95b23fbce285c989575be0b558a3a9d38fb8f`.
  Two add/add conflicts retain the latest SW-0042 report (including original
  equivalent report and Lead recovery history) and frontend compatibility re-export.
  `packages/contracts/src/dto.ts` stays the sole generated wire source, using
  frozen OpenAPI `0.3.2-core-proposal`; API/frontend re-exports remain unchanged.
- `0187754`: merges corrected core `d01aba2` with complete original core/review
  history. README conflict retains both shared-workspace and core documentation;
  test discovery description now accurately includes pure DB-helper unit tests.
  Standalone API `bun.lock` modify/delete conflict resolves to deletion.
  Root lock regenerated with Bun **1.4.3**, then frozen-installed successfully.
  Drizzle Kit **0.31.11** added by the source branch; existing resolved package
  identities remain present (no previously resolved version removed).
  New transitive esbuild versions and lock key relocation belong to Drizzle Kit;
  no existing declared dependency version changed.

No source behavior compatibility fix was required. Root Turbo configuration and
operational commands remain unchanged: DB/proof entry points are explicit and
noncached, outside ordinary unit tests/builds. No SecureStore feature was added;
clean SW-0055 had no new source to merge.

## Fresh verification

All commands run from this integration root unless an API cwd is specified.
The checked source tree is `0187754`; final report-only commit changes no executable input.

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | pass, root lock unchanged |
| `bunx turbo run typecheck typecheck:e2e check:generated test lint format:check export:web export:ios build:worker --force` | **15 successful / 15**, **0 cached**, 25.548 s |
| API `bun test tests` through Turbo | **67 pass / 0 fail**, 6 files, including money/replay/target pure unit suites |
| Frontend unit tests through Turbo | **53 pass / 0 fail**, 6 files |
| API cwd: `bunx drizzle-kit check` | pass, offline migration metadata consistency |
| API cwd: `bunx drizzle-kit generate` | 21 tables, no schema changes, no generated diff |
| `bun run test:e2e` | **24 expected, 0 skipped, 0 unexpected, 0 flaky**, 50.630 s |
| `lsof -nP -iTCP:18047 -iTCP:18048 -iTCP:18049 -sTCP:LISTEN` after E2E | no listeners |
| `git diff --check` | pass |

E2E runs desktop/mobile Chromium demo plus actual local workerd HTTP handlers.
It does not establish API-backed domain UI, native identity/provider behavior,
production deployment, or live DB correctness. iOS export proves JS bundling.
Workers build is dry-run only. Prior baseline evidence at local841/843 is recorded
in `SW-0056-integration.md`; fresh consolidated checks above supersede it for this tree.

Live core21/session4/races20 verification remains with the Lead/reviewer exclusive
synthetic DB window. SW-0052 reviewer on d01aba2 has sole DB ownership; this worker
has requested explicit handoff and has not inferred permission from elapsed time.
Core cannot reach local until that reviewer approves. The eventual report-only
SW-0052 commit must also be merged with full ancestry by the Lead if it lands
following this worker settlement.

## Pre-existing branch ancestry

Every tip captured at integration start is an ancestor of `0187754`.
A future reviewer report commit is a subsequent tip and remains a Lead merge gate.

| Branch | Captured tip | Result |
| --- | --- | --- |
| `local` | `843f4578f1f8b64494920a7a504217a044c9b20c` | ancestor |
| `main` | `7d9c825264f752faf3ed77aaa89853123cd8113d` | ancestor |
| `witchagorn/sw-0004-core-data` | `e62d1ada148af967879ff271c49069d5af8367d1` | ancestor |
| `witchagorn/sw-0004-core-data-impl` | `e14a0bc48dfd9e24e3fc6df9dbf8920263ea02ec` | ancestor |
| `witchagorn/sw-0036-core-lead` | `e50ed8bb23a2e02371e9a5c7b8097a39c8e1f41d` | ancestor |
| `witchagorn/sw-0038-runtime` | `a648cce9adfaa088e2bda04795697818953d6793` | ancestor |
| `witchagorn/sw-0040-front-dto` | `780bbd1e3855ca013a3c97fa78582cbe11b68f2a` | ancestor |
| `witchagorn/sw-0041-runtime-review` | `281d1396436d978fa8f03d0da0b0735b25318d4a` | ancestor |
| `witchagorn/sw-0042-front-dto` | `b8d95b23fbce285c989575be0b558a3a9d38fb8f` | ancestor |
| `witchagorn/sw-0046-core-data-review` | `b9906e586c5f44270e9d99d8bd9a3fb41c7844fa` | ancestor |
| `witchagorn/sw-0049-session-race` | `d01aba2cae6c1a30da40b1e47ee5e7f9be08cdc3` | ancestor |
| `witchagorn/sw-0052-session-review` | `d01aba2cae6c1a30da40b1e47ee5e7f9be08cdc3` | ancestor |
| `witchagorn/sw-0055-secure-credentials` | `018b6fa35fb65bdac50f7124459267f8a297f9c5` | ancestor |
| `witchagorn/sw-0058-consolidate` | `56c52584f2df340c5e7e9ba33d13ef407a729aee` | ancestor |

## Read-only legacy draft audit

Compared every tracked dirty/untracked file in both exact worktrees to reviewed
current descendants, without modifying, deleting or committing any original.
Lead independently preserved all 13 files, binary patches and per-file hashes in
`/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/sw-0058/`.
Full per-file comparison is in the durable artifact `draft-comparison.json`.

Core draft `sw-0004-core-data-impl` (9 files):
- Drizzle config is byte-identical. Money helper and its tests match exactly after
  formatting the draft through current Biome using stdin (no draft file writes).
- Normalized schema differs only by reviewed `statement_timestamp()` defaults,
  an unused jsonb import removal and unused callback parameter rename.
  SQL and snapshot show the same 20 timestamp-default replacements; journal gains
  the registered operations migration. These are obsolete draft versions.
- Draft manifest/standalone lock predate shared contracts, issuer and root workspace
  dry-run build; Drizzle Kit dependency is retained in the root workspace.
  No unique executable functionality requires merging.

DTO draft `sw-0040-front-dto` (3 files):
- Generated source targets older proposal `0c88553`; current canonical DTO is
  generated from accepted 0.3.2. Older generated bytes must not replace it.
- `types.ts` contains unique unused aliases ApiPaths/ApiOperations/ApiSchemas and
  HouseDto/BillDto/PaymentDto/ChoreDto/ActivityDto/ErrorDto. Graft exhaustive query
  found no consumers among 71 indexed files. Current reviewed types cover active
  consumers; adding obsolete aliases would expand scope without a requirement.
- **Unique historical report** `docs/team/reports/SW-0040-dto.md` describes the old
  proposal generation and contract questions. Preserve it as history, not an
  acceptance verdict. A byte-identical copy is retained in artifact
  `SW-0040-dto-draft-original.md`; original stays untouched in its checkout and
  Lead snapshot. No unique product behavior was found.

All 12 original draft files below were hash-verified unchanged after the audit.
The Lead’s 13-file snapshot also includes the separate dirty user guide.

Original draft content hashes:

| Worktree | File | SHA-256 |
| --- | --- | --- |
| `sw-0004-core-data-impl` | `ourhoomu-api/drizzle.config.ts` | `6c6573f62ea9f9299cf8faa2e404d83cb33394acf16015eb622a32ce2263fba1` |
| `sw-0004-core-data-impl` | `ourhoomu-api/drizzle/0000_core_schema.sql` | `df2990e3fa0669ea1bae466296554ebfd531fe0b2786435dce8ea234b22d2a27` |
| `sw-0004-core-data-impl` | `ourhoomu-api/drizzle/meta/0000_snapshot.json` | `8a1916164a36e489a703035ffb6df506b933990009c7f540200970da315d0788` |
| `sw-0004-core-data-impl` | `ourhoomu-api/drizzle/meta/_journal.json` | `0931b825e4642de672c31c3b85dde7da3d0eea73c62a63cd19a81a67b23fb1fe` |
| `sw-0004-core-data-impl` | `ourhoomu-api/src/db/money.ts` | `8e7c3e892828a8387f0d646f3e0ed1ca631e9f62522db0f34a8b383d81a0043b` |
| `sw-0004-core-data-impl` | `ourhoomu-api/src/db/schema.ts` | `bb534fed3b8028a613a0d3157c45c3980ef07dc85cdaa4095a1ea140fef75007` |
| `sw-0004-core-data-impl` | `ourhoomu-api/tests/db/money.test.ts` | `478c1ce7baf2d7a50cbe1032e4d4938024c7f8f00934c060002cc8abfe0e3f39` |
| `sw-0004-core-data-impl` | `ourhoomu-api/bun.lock` | `361ef7bdf12ec4437f37b84c06c710b11018eb07f6a6836e294d6429a619948f` |
| `sw-0004-core-data-impl` | `ourhoomu-api/package.json` | `b1e60e270b28b35dbfa305b2660da5ed03c3b49c09b6f6c595ff83c596cb3530` |
| `sw-0040-front-dto` | `docs/team/reports/SW-0040-dto.md` | `78fe3f6ceb0a589e15b219dde1a5110472b77814631fcc1bc03898e02ed5c196` |
| `sw-0040-front-dto` | `ourhoomu-front/src/api/dto.ts` | `8ac08bf41bdc22f87ebd2c985e70fbff0bdf95a165c258018ec6058d46d4b804` |
| `sw-0040-front-dto` | `ourhoomu-front/src/api/types.ts` | `daaf50b1e91df1729f53da732e681a9dc576d15d90815759a0aa8161035ffdcc` |

## Graft and runtime evidence

Using installed `graft` skill and Tech Lead `references/agent-runtime.md`.
CLI **0.21.1**. 🌱 Graft: **ACTIVE**, exact integration worktree:
initial `graft map` returned 57 files/248 symbols/645 edges and savings estimate
104,596; core query refreshed 14 files and returned current CoreDatabase/DB unit
helper pointers, estimate 2,410. Final exhaustive alias grep searched 71 indexed
files and found no hits; `graft check` passed wiring freshness (meaning/deep layer
not built; no deep analysis claim).

Exact core draft `graft map`: ACTIVE, 42 files/117 symbols/366 edges,
estimate 82,801 on each of three map calls (one duplicate log invocation noted).
Exact DTO draft `graft map`: ACTIVE, 28 files, estimate 66,478 on each of two calls
(the logged second call ran in its frontend cwd and explicitly resolved the same
worktree's root graph). Configuration/docs and detailed diff ranges read raw
because graph retrieval does not supply complete merge/draft bytes.

Observed launch: PID6956, parent6485,
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`.
Session effective developer settings explicitly report `approval_policy=never`
and `sandbox_mode=danger-full-access`. Worker role/scope still governs DB and
merge restrictions. No coordinator or worker was spawned by this integration worker.

Durable artifacts:
`/Users/afe/orca/artifacts/ourhoomu/SW-0058-consolidation/` contains install,
quality, final15-gate, build and E2E logs, machine E2E JSON, draft comparisons,
normalized read-only schema/money comparisons, Graft maps and original DTO report.
Observed retrieval savings estimate subtotal: **488,365 tokens** over 7 calls
with retrieved savings lines (including duplicate map invocations). Two earlier
integration map outputs were transport-compressed and are excluded from this
subtotal; alias grep and freshness/version calls reported no savings. This is
an estimate, not billing.

Task `task_b44d0cb5e3b5`, Dispatch `ctx_a3f158609e97`.
