# SW-0056 — Integrated Turborepo acceptance

Accepted 2026-10-15 by Tech Lead. User prioritized migration with Bun workspaces and packages/ for shared types, schemas and genuinely shared functions. App directories and product behavior are preserved.

## Source and review
Integration target is `local` at `/Users/afe/Desktop/ourhoomu`, baseline `e50ed8bb23a2e02371e9a5c7b8097a39c8e1f41d`. Implementation `6a14757`, original report `2fb56a5`, independent review `d28e840`, correction `ce113b4`, Lead acceptance `8416702`. This final documentation commit follows tested source without changing executable inputs.

[Implementation](SW-0056-turborepo.md), [independent review](SW-0057-turborepo-review.md), [correction proof](SW-0056-turborepo-corrections.md). Original review requested R1/R2; it is historical. Non-author Lead verified corrected config/docs and exact synthetic evidence, rather than claiming an independent reviewer reran the corrections. R1 restores Expo dotenv selection, hashes ignored dotenv files and clears Metro transforms when export executes, fixing a measured stale-output case. R2 replaces obsolete npm setup instructions. Broad API unit discovery is also restored.

## Fresh integrated verification
At `8416702` in the main checkout:

```sh
bun install --frozen-lockfile
bun run turbo run typecheck typecheck:e2e test format:check lint check:generated export:web export:ios build:worker --force --summarize
bun run test:e2e
graft map
graft check
git diff --check
```

All exit0. Frozen install:688 packages,2.81s. Forced checks/builds:15/15 successful,0 cached,21.088s; API63 + frontend53 unit tests, app/contracts/E2E types, format, API lint, generated-contract reproducibility, web/iOS JS exports and Workers dry-run. E2E24/24 in32.5s uses real local workerd and desktop/mobile Chromium; temporary servers shut down. No DB/provider calls or deploy.

Lead direct checks additionally confirm shared DTO bytes equal baseline frontend DTO, canonical OpenAPI bytes unchanged, original Neon dependencies unchanged, generator check succeeds and both Neon tooling modules import. All final generated web/iOS outputs contain no synthetic proof sentinel. Existing shared-source proof shows15-task cache hits and downstream invalidation; correction proof covers each dotenv file hash, production-local precedence, actual changed web/iOS bundle, explicit caller override and unchanged cache HIT. Cold export clears Metro and may cost more time.

Graft ACTIVE: exact integrated map57files248symbols645edges; check wiring in sync305nodes, semantic layer pending with no deep-layer claim. Lead retrieval estimates sum364056 tokens across4 figure-reporting calls; worker estimates remain in their reports and are not included in this sum.

## Preservation and lifecycle
Run `run_bc557bc8a370`:

| Role | Task | Dispatch | Settlement |
| --- | --- | --- | --- |
| Implementation | task_e756bf61f77e | ctx_3da6ec233de5 | succeeded, released/captured/acknowledged |
| Independent review | task_0548d4361ca6 | ctx_6a4bd024f42b | review succeeded with findings, released/captured/acknowledged |
| Corrections | task_963c1077f204 | ctx_cfa9dbddd069 | succeeded, released/captured/acknowledged |

Reports, transcripts, source proof logs, integrated logs and actual lifecycle receipts are retained in main `.git/ourhoomu-snapshots/sw-0056/`. No reclaimable worker remains. All launches used Codex bypass permissions with runtime evidence in reports/snapshots. No model override was made.

The user's pre-existing dirty `docs/team/agent-guide.md` is unchanged by SHA-256. The previous untracked root lock is preserved byte-for-byte as `.git/ourhoomu-snapshots/sw-0056/preexisting-root-bun-before-integration.lock`, while the approved workspace lock now occupies root `bun.lock`. Other user/system worktrees are preserved.

Owned cleanup target: Orca worktree `sw-0056-turborepo`, branch `witchagorn/sw-0056-turborepo`. Safety checks establish source ancestry in local, clean tracked/untracked state, generated ignored artifacts only and no remaining worker workload. Orca `worktree rm --run-hooks` receipt is stored as `.git/ourhoomu-snapshots/sw-0056/cleanup-receipt.json`; final inventory is stored alongside it. The idle initial shell belongs to this newly created worktree and is closed through Orca removal.

## Scope limits
No shared utils package is fabricated: existing money/date helpers have a frontend consumer only. Canonical shared API schema remains at its documented OpenAPI path and produces the single contracts package DTO; database schemas stay server-only. Native iOS builds/devices, production schema/data, real issuer/provider flows, remote caching, TestFlight, push and deployment are outside this migration acceptance. Root and app READMEs document commands; future manifest changes must update the root lock from the workspace root.
