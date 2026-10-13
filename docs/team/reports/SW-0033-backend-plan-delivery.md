# SW-0033 — Backend plan / frontend coordination delivery

2026-10-13 · **Planning and source research accepted; product implementation pending user confirmation.**

## Delivered

[Backend plan v0.2](../backend-plan.md) covers contract36, runtime3, core data4, session/house5+frontend9, bill/cash6+frontend10, chores/feed8+frontend11, data extensions37, slips7, LINE18, retention13 and independent QA12/native release14. Each has owner/files/consumed and produced contract/dependencies/steps/check plan. Frontend demo/calendar/theme/motion remain accepted; live auth/house/account/bill/slip/cash/undo/cache/errors are explicit integration work.

Research22 recommends actual Wrangler/workerd smoke and request-scoped Neon interactive transactions with parameterized local actor, fallback complete SQL routines. Research24 leaves Neon Managed Apple exchange unresolved; Lead successfully retrieved the official OAuth Markdown with curl after browser content-type limitation. Research23 records scheduler capacity/copy/deletion gaps; SlipOK FAQ mixed content cannot replace mode-specific retention terms. No application tests, scaffolding/install, remote configuration, database writes, real slips/messages or deployment occurred.

## Independent review and resolution

[SW-0035 review](SW-0035-plan-review.md) initial frozen SHA `d0fa2b3b3107e22ab1db05f0205092f75082e789`: changes_requested, one P1. SW-0003 still required native startup despite narrowed API scope. Lead fix `a3bc4a4a90fd08b507c61ebb64db0e1fcd08ecbe` makes API/runtime AC2 explicit and preserves original native startup as SW-0009-AC5, pending real native evidence. Independent focused recheck at that SHA: **approve**, report `60e32922e03f2527724c4d5fa8ca111f0751de2e`; original finding preserved. Core4/extension37 dependency graph has no cycle; full private-slip/data criteria are not closed by core-only acceptance.

## Actual execution

Run `run_ab1ca0ad83c1`; coordinator `term_64588939-5e2c-4ec0-a5d2-a34ed614b39e`; target `local`; initial baseline `9e4c119b2d2edcac50332dc021140f5c2aa15d48`; planning base `f223f0d1137811951aff8ebaf6f1aba4e8da6d7e`. At most3 independent workers active; six successful Dispatches across five project planning/review tickets. Review retry is a new agent/Dispatch, not a retained settled terminal.

| Ticket / attempt | Task | Dispatch | Artifact commit | Worker-release receipt |
|---|---|---|---|---|
| SW-0022 runtime research | task_f1de27ad1c58 | ctx_9b62c8a6484c | 119874147ebabd4ee008c498e6542194afc2fb58 | 10949809-9c6c-47e7-be68-49425b94697e |
| SW-0024 identity research | task_3c4069f77cc3 | ctx_6d4150434b4e | f8d6a7da8d6fc561572680553258ee53b1024962 | 14482a51-aeaf-4dff-bb79-54c721e39642 |
| SW-0034 FE integration plan | task_c688b8dd9129 | ctx_215f65849374 | d9a9c0953bc6dd918d64625eb686b86e52fcd54d | bfcfb021-8846-47ff-b605-05e06d4d970d |
| SW-0023 retention research | task_4d84eef6a8c6 | ctx_52b415676d25 | 2ce216b6bc265d0df69bb69f491e936601be0fb0 (Lead adopted) | 8ee2ffaf-094f-4fd3-a6cc-a2475cf1aab3 |
| SW-0035 initial review | task_0dace74d0843 | ctx_6569b5230fc9 | 693c7ed386af170495faf94ff185f346d393e823 | 4858c663-0257-45f8-b533-d1f93528b752 |
| SW-0035 focused recheck | task_5c9172d77f03 | ctx_1de040d32172 | 60e32922e03f2527724c4d5fa8ca111f0751de2e | dc789f8d-640d-4f69-b779-449b964d7340 |

All releases closed owned agent terminals and captured transcripts, after report/artifact capture and before delivery ack. Deliveries acknowledged: delivery_6d1e6572d6a1, delivery_41e8588bcba8, delivery_dcfa19f33d17, delivery_13221345b089; heartbeats separately processed. SW-0023 settled with an uncommitted assigned report; Lead preserved it first, released worker, then adopted/committed that exact file before merging. No work was discarded.

Research/review inherit runtime configured model (observed first research workers gpt-6-luna); frontend launch.effective gpt-6-sol per installed profile. Profiles configured never/danger-full-access. Lead checked actual bypass argv for first three launches via PID/cwd; later released processes' argv were not captured, so effective permission evidence is not extrapolated to them.

## Verification and scope evidence

- `git diff --check`, report-owner diff/status checks and ancestry passed at accepted artifacts; fresh integrated documentation checks recorded with final SHA in ticket/local audit.
- Local link/path/dependency checks: 74 Markdown/386 links before final record additions, zero broken paths/unknown dependencies/cycles/cancelled Figma dependencies. 37 ticket files include historical plain Markdown; SW-0001 is historical and absent from current board, excluded from active-board completeness assertion. Final updated counts captured separately after final documentation commit.
- `git diff --stat 9e4c119 HEAD -- ourhoomu-front ourhoomu-api package.json package-lock.json neon.ts` empty: no app/config changes.
- Root user guide diff SHA256 `a766ad73c7f245d95ee0bd8e5e9d6f2446dcd6bed1d03dfd6a8a78f1ab17b0f0`; root unknown-owner bun.lock SHA256 `2e69b3b1db7f48e00f33afc10d213e122a40c29d16016e6beae65091aaa604fc` preserved.
- Graft0.21.1 **ACTIVE** root/exact Lead/workers: supported-code build/check26files110nodes293edges. Reports/plan/tickets are unindexed Markdown and read raw; retention scope NO_INDEXED_FILES. Deep concept layer not built. Lead visible savings subtotal31,487 (map29,825 + skeleton1,662); another map output was clipped in orchestration output and is not included in the recorded subtotal. This is tool-estimated saving, not measured API usage. Worker-reported FE51,548/identity29,825 remain separate estimates; other research/reviews report no retrieval estimate.

## Cleanup and runtime retry causes

Five worker worktrees removed only after clean tracked/untracked status (ignored graft cache only), ancestor-of-local proof, no active writer and durable report capture. Worktree/branch removal through selected `/usr/local/bin/orca`, `--run-hooks`, no force:

| Owned worktree | Removal receipt |
|---|---|
| sw-0022-runtime-research | 1d6af89f-2295-4533-8674-a5405a4a9b9d |
| sw-0023-retention-research | 8ae3047e-8901-4866-9fa0-51a521ef9408 |
| sw-0024-identity-research | ef5b6929-936d-4d3d-96ca-a2a6815dcecc |
| sw-0034-front-integration-plan | 2ef4c39b-b7f1-4bdc-bcf8-c2e3b95785af |
| sw-0035-plan-review | b71e4de9-466e-4ed5-84e7-e3126cc494c8 |

Lead worktree sw-0033-backend-plan closes after final records merge/check; actual final receipt/inventory stored in root `.git/ourhoomu-snapshots/sw-0033/final-delivery.json` and preserved root Orca comment, which survive workspace deletion.

Pane display attempts using terminal split returned `runtime_error: Timed out waiting for split pane handle` three times; inventory subsequently showed no created monitor terminals/panes, worker tabs remained separate. No duplicate agent was started for display. Existing root/user terminals untouched. Focused-review start initially refused `--setup skip` on an existing checkout before dispatch; following returned nextSteps, removed that flag and received actual new Task/Dispatch. No failed live attempt was duplicated. Two documentation-check script assumptions (plain Markdown tickets and historical SW-0001 board omission) were corrected explicitly rather than treating failures as source defects.

## Next owner / remaining gates

User via Lead reviews [plan section2](../backend-plan.md) under AGENTS.md before application implementation. SW-0036 then freezes material contract, and platform/data/backend/frontend execute approved waves. LINE recipient/binding/external copies, SlipOK sufficient matching/retention/credentials/budget, Google+Apple native issuer proof and provider credentials, isolated development DB target, physical purge/backups and TestFlight/production authorization remain scoped prerequisites. Planning/research success closes no AC1a–AC7/AC10 runtime acceptance.
