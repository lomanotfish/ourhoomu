# Frontend local integration — SW-0026–0031

Date: 2026-10-13 · Tech Lead verdict: **accepted for local frontend demo**

## Delivered scope

React Native/Expo Router frontend with cream, peach, coral, mint and cocoa theme, bundled Thai font, original home illustration and animated entry/press/navigation/completion. Four tabs cover overview, bills, chores and house; local demo flows include house selection/create/sample join, members/settings/reset, bill splitting and pending partial requests, chore schedules and activity. Figma is no longer a dependency under the user's direct frontend authorization.

The demo repository holds sample data in memory and resets on reload. Outstanding money is never reduced by a pending request. Real OAuth, API, SlipOK, LINE, retention and TestFlight remain on their existing tickets; this delivery does not close those acceptance conditions.

## Integration and review

| Artifact | Evidence |
|---|---|
| Target and initial baseline | `local`, `fa82194fb9e537692f233cb841981f61269f0424`; current checkout contains the latest accepted docs, unlike older `main` |
| Design | SW-0026 `5d95eb5` / `43cf37c`, accepted with Lead pending-only payment refinement |
| Frozen frontend | `c4e913cc8bca5640ad7d41c574444c7dce66c8e5`; implementation `d36f02a`, report `77e6b90` |
| Independent review | SW-0028 **approve**, report `832af66`; reviewed core plus SW-0029 copy through `1fe9fdf` |
| Narrow Lead fixes | SW-0029 `fc4c094` / `1fe9fdf` plain copy; SW-0030 `8cb1c22` held-press cancellation/reset and 44pt filters; SW-0031 `569a4ea` / `06bde41` six boolean guards for optional strings |
| Integration method | Source/review branches merged into the isolated Lead branch with `ort`, then fast-forwarded into root `local`; worker/source tips are ancestors of target |
| Source checkpoint | `80a5b9c` → `fef80d2` → final tested source `97eaa6eb8e4fa2515eab71c38ca0ed1cdc4234bd` |

[Independent review](SW-0028-review.md) and [worker report](SW-0027-frontend.md) retain their actual reviewed/tested SHA and commands. SW-0030 implements the review's narrow recommendations; SW-0031 corrects a fresh dev-preview finding. Those small Lead fixes were inspected and verified by the Lead, not represented as a second independent review. Native form-error announcement/focus, VoiceOver, large Dynamic Type and native modal/keyboard behavior remain in the native integration gate.

## Checks on integrated source 97eaa6e

Run from root `ourhoomu-front/` unless otherwise specified:

| Command/action | Observed result |
|---|---|
| `bun install --frozen-lockfile` | Passed after initial integration at 80a5b9c; later fixes do not change dependencies/lockfile |
| `bun run typecheck` | Exit 0 |
| `bun run format:check` | Exit 0, all matched files formatted |
| `bun run test` | 3 pass, 0 fail, 19 assertions: satang/bps parsing, exact allocation, self coverage and pending reservation |
| `bun expo install --check` | Dependencies up to date |
| `bun run export:ios` | Exit 0, 4.8MB Hermes JS bundle and 24 assets, bundled Thai font; this is not a native build |
| `bun run export:web` | Exit 0, 15 static routes; generated dist ignored |
| Chrome / Playwright smoke | Passed: demo entry, all four tabs, new bill/back; 393×852 overview/bills, 320×568 chores/house/form |
| Filter target bounds | Bill filters and today/week/date controls all measured 44px before scaling |
| Held press + reduced motion | Held transform scale 0.977408 → immediate identity matrix when preference changed → identity after release |
| Browser runtime | Zero page exceptions and no application console warning/error; one separate `/favicon.ico` 404 from the dev preview remains |
| `git diff --check` | Exit 0; repeated after documentation edits |
| Local Markdown path audit | 62 Markdown files, 339 local links, zero broken paths; existing frontmatter dependencies present/acyclic, 30 tickets, zero cancelled-Figma dependencies |
| `git diff fa82194 HEAD -- package.json package-lock.json neon.ts` | Empty: root Neon tooling unchanged |
| Native preflight | `xcrun simctl` unavailable on this machine; no iPhone/Simulator launch claimed |

Updated renders were opened for visual inspection: [overview 393px](../../../ourhoomu-front/docs/preview/integrated-overview-393.png), [bills 393px](../../../ourhoomu-front/docs/preview/integrated-bills-393.png), [chores 320px](../../../ourhoomu-front/docs/preview/integrated-chores-320.png). Thai text/theme/navigation render without the former dev warning overlay. The worker's wider functional walkthrough remains in its report; this smoke targets the integrated artifact and follow-up fixes.

Local preview is intentionally running from the root frontend at `http://localhost:8081` using `bun run web --port 8081`. It is a Lead preview process, not a settled worker terminal or external deployment. Restart commands are in the [frontend README](../../../ourhoomu-front/README.md).

## Runtime, cleanup and preserved work

Orca executable `/usr/local/bin/orca`, Run `run_ad3b5396e327`. Real worker launch/permissions evidence is in their reports: Codex used `--dangerously-bypass-approvals-and-sandbox`; frontend role `gpt-6-sol`, designer/reviewer default inherited. No native-subagent replacement was used.

Reports/screenshots were saved in tracked paths and root `.git/ourhoomu-snapshots/` before release. Accepted settlements were followed by `worker-release` with captured transcript/closed owned terminal before delivery acknowledgement:

| Task | Dispatch | Release receipt | Acknowledged delivery |
|---|---|---|---|
| SW-0026 | `ctx_4e6910965a66` | `c3e31507-0756-4f1d-bfcf-234d7d7d4f87` | `delivery_3c0d10cbc66f` |
| SW-0027 | `ctx_94393ae74fb9` | `db58d00a-f5da-4401-9fcc-39c746016758` | `delivery_2aa2484982c6` |
| SW-0028 | `ctx_812dafad5859` | `2805845d-fe4d-43a8-9f93-732563ea1b7d` | `delivery_de69fe21ec07` |

`orca orchestration worker-list --run run_ad3b5396e327 --json` confirms all three succeeded/completed/released with exited liveness; the reclaimable filter returns no workers. Before removal, source tips passed `git merge-base --is-ancestor HEAD local`; tracked/untracked trees were clean. Ignored contents were only generated Graft/.expo/dist/node_modules. No active worker or dependent process used them; the copy worktree's only terminal was the unused shell created by Orca.

| Owned worktree removed through Orca `worktree rm --run-hooks --json` | Receipt |
|---|---|
| `sw-0026-frontend-design` | `b8ce4c86-0aa9-412e-b22b-b5945918a865` |
| `sw-0027-expo-frontend` | `eac82392-0c1b-4fd7-9e2d-dfe9079f36b1` |
| `sw-0028-frontend-review` | `86070f82-8569-4568-8184-e9ce183542d7` |
| `sw-0029-demo-copy` (SW-0029/30/31) | `c0771345-92b7-4b7e-a8de-c31f2b5fc547` |

Git inventory confirms those paths/branches removed. Lead documentation workspace remains only to commit/integrate these final records; its final cleanup receipt and inventory are saved in root `.git/ourhoomu-snapshots/sw-0027/` and the Orca root comment after removal. Coordinator remains in the root checkout.

The user's dirty `docs/team/agent-guide.md` is preserved exactly: diff SHA256 `a766ad73c7f245d95ee0bd8e5e9d6f2446dcd6bed1d03dfd6a8a78f1ab17b0f0`. Unknown-owner untracked root `bun.lock` is preserved, separate from the committed frontend lock. The Expo-generated untracked frontend `.gitignore` contained only the already ignored expo-env pattern; an audit copy was saved before removing that generated file.

## Graft evidence and recovery

Graft 0.21.1: initial frontend scope **NO_INDEXED_FILES**, then **ACTIVE** after scaffold. Latest `graft build --no-gitignore --no-ignore --only-dir ourhoomu-front` plus `graft check` succeeds in root and each exact retained ticket worktree before cleanup: 22 files, 95 nodes, 253 edges; graph in sync. Deep concept layer was not built or claimed. Raw reads are for non-indexed docs/config/diffs or precise source ranges identified by Graft.

Lead queries emitted 46,680 estimated tokens saved across five figure-reporting calls before resume, then 33,383 across four calls while diagnosing empty status rendering, **80,063 across nine calls** total. These are summed tool estimates, not measured usage. Worker estimates are separate: frontend 48,406/five, reviewer 94,883/25; designer had no frontend indexed files and claimed no savings.

Recovery notes: the Lead graph was stale after source integration and rebuilt; root graph was stale after the optional-string fix and rebuilt. SW-0031 initially lengthened a title line beyond Prettier's style; the next narrow formatting commit corrected it before all integrated checks were rerun. Early CLI invocations used an unsupported unprefixed worker-list and click flag, then used the actual orchestration/element commands. Smoke harness metadata was corrected to record actual `git rev-parse HEAD`; final evidence targets 97eaa6e. No acceptance assertions were removed to pass. Native runtime blocker owner: later frontend/platform integration tickets, requiring Xcode/device environment.
