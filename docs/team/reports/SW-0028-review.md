# SW-0028 — Independent frontend review

Date: 2026-10-12 · Reviewer: code-reviewer · Verdict: **approve**

## Reviewed artifact and scope

- Baseline: `a7ec76b15ca459c2f5b41c18b5e11b7bcb2eb3c2`.
- Frozen frontend: `c4e913cc8bca5640ad7d41c574444c7dce66c8e5`.
- Lead-requested SW-0029 follow-up: `fc4c0940984e2d2cf6e5531694633554ab2b5019`, then current tip `1fe9fdfc7c226fe1c98d327a4036051779728116` (`witchagorn/sw-0029-demo-copy`). Reviewed the exact nine string replacements in seven screens from the frozen frontend, followed by two shorter wording replacements; no behavior/configuration/dependency changes. The branch initially still resolved to the frozen commit; review proceeded only after the actual commits became available.
- Review worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0028-frontend-review`, branch `witchagorn/sw-0028-frontend-review`; source remained frozen. Task `task_3bda20c234e6`, Dispatch `ctx_812dafad5859`.
- Acceptance: runnable local Expo **demo**, SW-0027/SW-0028 latest tickets in the Lead worktree and accepted `/Users/afe/Desktop/ourhoomu/docs/project/frontend-design.md`. Native/API/TestFlight acceptance remains separate.

## Findings

No material blocking defect found in the reviewed demo paths. Approve the frontend plus the reviewed copy follow-up for local integration; this is not native/device or production integration approval.

Non-blocking advisories:

1. `ourhoomu-front/src/components/ui.tsx:146`: `Tap` suppresses new springs under reduced motion but does not stop an active spring/reset its scale when the preference changes. If reduced motion is enabled during a held press, releasing skips the restoration spring and can leave the control scaled. Add cancellation and an immediate scale reset on preference changes; this narrow transition is not covered by native runtime evidence.
2. `ourhoomu-front/app/(tabs)/bills.tsx:88` and `ourhoomu-front/app/(tabs)/chores.tsx:178`: filter controls override the shared 44pt minimum with 42pt. Raise them to 44pt to match the visual contract. `ourhoomu-front/src/components/ui.tsx:300` also renders errors without an accessibility announcement; invalid form submission does not focus the first invalid input (`app/bill/new.tsx:53`). Improve this before the native accessibility gate.
3. SW-0029 `ourhoomu-front/app/bill/[id].tsx:211` leaves the old “ในภายหลัง” after the replacement sentence about unchanged outstanding, producing awkward copy. Remove that leftover line. `app/house/select.tsx:121` still says “flow”; plain Thai would finish the copy cleanup. These do not change financial state or claim a real integration.

## Assessment

- Money uses positive integer satang, integer bps, exact 10,000-bps validation and BigInt largest-remainder allocation with stable tie order. Equal thirds preserve totals; 99.99%/100.01% cannot publish. Recipient self coverage follows the recipient, including zero coverage when outside the split; the creator is not credited merely for creating a bill.
- Pending cash/transfer requests reserve capacity through `availableToRequest`; repository submission checks the live state and never reduces outstanding. Withdrawal removes the reservation. No confirmation simulation, slip upload or real payment control is exposed.
- Entry, four tabs, bill filters/create/detail/back, payment sheet/cancel, activity, house switch/create/sample join/reset and manual/repeat/rotation preview have working handlers. Chore completion is restricted to the assigned current member and records activity. Bills/chores/activity are selected by active house; detail lookup uses the filtered bills. Reset requires explicit confirmation.
- Expo Router entry, app/config/scripts, package-local Bun lock and documented versions align; root dependencies/Neon/API remain untouched. Generated Expo outputs are ignored. Indexed source search found no app fetch/axios/HTTP endpoint or provider credential implementation. Auth/LINE/accounts/payments remain disclosed as unavailable or sample-only.
- Saved 390×844 overview/chores and 320×568 pending-bill PNGs were visually inspected: readable Thai text, coherent theme, labeled navigation and separate pending/outstanding amounts in the captured portions. Shared pages scroll with keyboard avoidance/safe-area padding; labels permit font scaling, and decorative art is hidden from accessibility. Reduced-motion queries/events are wired into entrance, art, stack and modal motion, with the advisory above.

## Verification and limitations

Reviewer-performed checks:

| Command / action | Actual result |
|---|---|
| `git status --short`, `git branch --show-current`, `git rev-parse HEAD` | Clean initial tree; assigned review branch at frozen SHA |
| `git diff --stat <baseline> <frozen>` | Scoped frontend/docs/README/ignore changes: 36 files, 4,821 insertions / 19 deletions |
| `bun test ourhoomu-front/src/demo/money.test.ts` | Bun 1.4.3; 3 pass, 0 fail, 19 assertions |
| `git diff --check <baseline> <frozen>` | Exit 0 |
| `git diff <frozen> fc4c094 -- ourhoomu-front`, `git diff fc4c094 1fe9fdf`, matching `--check` | Nine copy replacements plus two shorter follow-up replacements inspected; whitespace check exit 0 |
| Image inspection | All three tracked `ourhoomu-front/docs/preview/*.png` opened |

The tracked SW-0027 worker report supplies frozen install, typecheck, formatting, SDK dependency check, web static export (15 routes), iOS Hermes JS export and Chrome/Playwright flow evidence at 320/390px. Those checks were not rerun or represented as reviewer-performed; no dependency installation or new application build occurred. This review inspected saved renders and source; no fresh interactive browser walkthrough was performed. The Lead owns the fresh integrated smoke after merge.

Native launch, iPhone VoiceOver/large Dynamic Type, native keyboard/modal focus and reduced-motion interaction remain unverified; the worker host lacked `simctl`. No API, real auth/payment/slip/LINE, retention or TestFlight acceptance is claimed. SW-0029 changed copy only, and its integrated render remains for the Lead to verify.

## Runtime and Graft evidence

Actual role file `/Users/afe/.codex/agents/code-reviewer.toml` configures `approval_policy = "never"` / `sandbox_mode = "danger-full-access"`. Live `ps -axo pid,ppid,args` identified this command process's parent, PID 36772, as `codex --no-daemon --dangerously-bypass-approvals-and-sandbox`, independently confirming skip-permission launch. `orca orchestration worker-show --dispatch ctx_812dafad5859 --json` confirmed the exact local worker/worktree/terminal with accepted input and live identity. Runtime access did not expand review ownership.

🌱 Graft: **ACTIVE** in the exact review worktree. `graft --version` → `0.21.1`; `graft build --no-gitignore --no-ignore --only-dir ourhoomu-front` → 22/22 files parsed, 95 nodes, 253 edges, 22 cards. `graft map` → 22 files / 73 symbols; source-bearing `ask`, exhaustive `grep`, and depth-2 `callers` traced money/reservations, navigation, chores, houses and motion. `graft check` → graph OK/in sync; no deep concept layer requested. `git check-ignore graft/` confirmed ignored local cache. Raw reads were limited to non-indexed docs/config/lock/diffs and the truncated or missing details identified by Graft.

Graft emitted savings estimates totalling **94,883 tokens across 25 retrieval calls that reported figures**. One additional retrieval and version/build/check supplied no figure; no savings are inferred for them. These are summed tool estimates, not measured API token usage.

Only this report is changed by the reviewer. Lead next action: integrate the approved frozen frontend, reviewed copy commit and report; run integrated smoke, retain evidence and handle status/release/cleanup.
