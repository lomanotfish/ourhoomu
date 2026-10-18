# SW-0058 — Existing work consolidated into local

Accepted 2026-10-15 by Tech Lead. User explicitly requested all existing work merged into main local branch. Integration target `/Users/afe/Desktop/ourhoomu`, branch `local`, advanced843f457→8bf5e89. The following final record commit changes documentation only.

## Included history and preservation
Complete merges: runtime-review281d139 via7495c3a, frozen DTO b8d95b2 via56c5258, corrected core d01aba2 via0187754 (including e62d1ad and b9906e5 ancestry), and independent security report5b6d540 via a later report-only merge. Canonical packages/contracts DTO, accepted API runtime/isolation and Turborepo are retained. Drizzle Kit0.31.11 is added to the API with the single root Bun lock; no standalone lock restored. Runtime/DTO old patches were already represented by newer reviewed code, so conflict resolution keeps that current code while retaining ancestry.

Every current/pre-existing local branch tip is an ancestor of integrated HEAD, including main and all ticket branches. No committed work remains outside local. Exact branch inventory is in `.git/ourhoomu-snapshots/sw-0058/initial-branches.txt` and final inventory alongside it.

Two legacy dirty drafts contain no unique executable product behavior requiring migration: obsolete DB schema defaults/generated DTOs and unused old aliases are superseded by reviewed code. Twelve draft files and the user's dirty agent-guide (13 total) remain byte-identical, independently hash-verified, with binary patches and copied files under `.git/ourhoomu-snapshots/sw-0058/`. The unique SW0040 historical report is also copied byte-for-byte into [tracked archive](archive/SW-0040-dto-draft-original.md), explicitly historical. No dirty draft, user-owned terminal or legacy worktree was deleted or committed on the user's behalf.

## Review and integrated evidence
[Worker merge/conflict/draft report](SW-0058-consolidation.md) and [independent security approval](SW-0052-session-race-review.md). Security review approves final d01aba2, resolving the original SW0046 captured-actor race after real lock waits. It independently ran core21/session4/races20 and verified five deployed function bodies plus original role/runtime-probe OIDs. No blocking review finding remains in that scope.

Lead compared all consolidated DB code, SQL, scripts and unit files against d01aba2 with `git diff --exit-code`: no differences. After reviewer released its exclusive synthetic window and all worker pools closed, Lead ran sequential `bun scripts/db/check.ts`, `check-sessions.ts`, `check-session-races.ts` from the consolidated API worktree using only existing explicit guarded synthetic paths. All exit0 (21/4/20 groups). No reset, migration, rehearsal, provider or production access. Logs are `integrated-db-{core,sessions,races}.log` in the snapshot store.

Fresh main-checkout commands at local8bf5e89:

```sh
bun install --frozen-lockfile
bun run turbo run typecheck typecheck:e2e test format:check lint check:generated export:web export:ios build:worker --force --summarize
bun run test:e2e
# From ourhoomu-api:
bunx drizzle-kit check
```

All exit0. Forced tasks15/15 successful,0cached,19.915s. API67+frontend53=120unit tests pass. App/contracts/E2E typechecks, format/API lint, generated contract reproducibility, web/iOS JS and Workers dry-run bundles pass. E2E24/24 in32.4s exercises desktop/mobile Chromium demo and actual local workerd production HTTP, without DB/provider calls; owned servers shut down. Offline Drizzle metadata check reports everything fine. Worker also checked generation yields21tables with no schema/file diff; no generation/migration was repeated against production.

Graft ACTIVE: exact integration and main maps71files342symbols892edges; wiring check413nodes in sync. No deep semantic analysis claimed. Lead retrieval estimates371298 across3 figure-reporting calls in this turn; worker estimates are separate in their reports. Final documentation changes are outside executable task inputs, and `git diff --check` passes.

## Runtime and cleanup evidence
Run run_59d090aea1ae. Review task task_194863971b2f / ctx_91568bd131fa succeeded with approve report5b6d540. Integration task task_b44d0cb5e3b5 / ctx_a3f158609e97 succeeded with source0187754/report665f3af+5fed9c9. Both reports/transcripts preserved before worker-release; both receipts released/captured before acknowledgment. Actual worker launch PIDs5909 and6956 included bypass approvals/sandbox flag; no model override. No reclaimable worker remains.

Permanent worker artifacts: `/Users/afe/orca/artifacts/ourhoomu/SW-0058-consolidation/`. Main snapshot store `.git/ourhoomu-snapshots/sw-0058/` retains original files/hashes, branches, reports, transcripts, integrated logs and runtime receipts. Only newly-owned sw-0058-consolidate worktree/branch is the cleanup target after merged ancestry/clean-state/generated-only checks; actual Orca removal receipt is `cleanup-receipt.json`, with final Git/worktree/worker inventory alongside it. Existing sw0052 review worktree and all other legacy/user worktrees remain preserved.

Core milestone is accepted, while full SW0004 remains in_progress for traced scope beyond core, known SW0054 timezone parity and SW0037 original privacy/provider extensions. SecureStore SW0055 has no implementation to merge. Domain API/native/provider/retention/production/TestFlight acceptance is not established by this consolidation. No push or deployment performed.
