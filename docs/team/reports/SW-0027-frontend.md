# SW-0027 frontend worker report

Date: 2026-10-12 · Role: frontend-engineer · Dispatch: `ctx_94393ae74fb9` · Task: `task_f21d639e3447`

## Commit and scope

- Worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0027-expo-frontend`; branch `witchagorn/sw-0027-expo-frontend`.
- Ticket baseline in this worktree: `a7ec76b15ca459c2f5b41c18b5e11b7bcb2eb3c2`. Implementation commit: `d36f02a58b458d81516318f5326bd0e00865c0bc`.
- Changed only `ourhoomu-front/**`, root `README.md` frontend status/commands, and root `.gitignore` generated frontend paths. This report is a second commit. No root package manifests, Neon, API, database, board, checklist or ticket status changed.

## Delivered

An isolated Expo Router/React Native TypeScript package with Bun lockfile, four Thai-first tabs, explicit demo entry, local Noto Sans Thai font and license, original SVG house art, cream/peach/coral/mint design, safe-area aware pages, entry/list motion, spring press feedback, modal navigation and chore completion feedback. `AccessibilityInfo.isReduceMotionEnabled` and change events suppress decorative motion and modal/navigation slides; labels, selected states and at least 44pt targets are present in key controls.

A typed in-memory demo repository owns houses, bills, payments, chores and activity independently of presentation. Users can switch/create/join sample houses (`MINT`), inspect members/settings, reset the demo, filter bills, create a bill with due date, another recipient, selected participants and equal or custom splits, inspect exact preview/detail, request or withdraw pending cash/transfer-demo installments, select chore dates, create manual/repeat/rotation schedules with two-week preview, and complete chores assigned to the current member. New-house empty states and form validation are visible. No app network calls or provider secrets are included.

Money uses integer satang, integer basis points and largest-remainder allocation with stable member-ID tie order. Recipient self coverage applies to the recipient only when included among participants. Pending requests reserve capacity but never reduce confirmed outstanding or claim payment verification. Transfer-demo status does not upload a slip or call SlipOK; cash has no arbitrary confirmation action.

## Verification

Environment: Node `v24.15.0`, Bun `1.4.3`, Expo `57.0.28`, Expo Router `57.0.26`, React/React DOM `19.2.3`, React Native `0.86.3`, React Native Web `0.21.4`, TypeScript `6.0.3`. Selected stable SDK from the [Expo SDK matrix](https://docs.expo.dev/versions/latest/) and npm dist-tags, then installed SDK-compatible modules with `bun expo install`. See [frontend README](../../../ourhoomu-front/README.md) for exact commands and remaining dependencies.

| Check | Result |
|---|---|
| `bun install --frozen-lockfile` in `ourhoomu-front/` | Pass; 612 installs checked, no changes |
| `bun run typecheck` | Pass |
| `bun run test` | Pass; 3 focused money tests, 19 assertions |
| `bun run format:check` | Pass |
| `bun expo install --check` | Pass; dependencies up to date |
| `bun run export:web` | Pass; 15 static routes generated |
| `bun run export:ios` | Pass; Hermes JS bundle and bundled Thai font generated |
| `git diff --cached --check` before implementation commit | Pass after trimming upstream font-license trailing whitespace |
| `xcrun simctl list devices` | Unavailable: `simctl` utility not found on this host |

Chrome headless rendered local static web export served by `python3 -m http.server` at 390×844 and 320×568. Playwright interactions exercised entry, four-tab navigation, bill creation/detail, another recipient, pending payment, chores/date/rotation, activity, house join, and empty states with no page errors. Screenshots: [overview](../../../ourhoomu-front/docs/preview/overview-390.png), [chores](../../../ourhoomu-front/docs/preview/chores-390.png), [pending bill](../../../ourhoomu-front/docs/preview/pending-bill-320.png).

Concrete walkthrough: created ฿200.00 bill with creator มิว, recipient บีม, 50/50 split; preview gave recipient self-covered ฿100.00 and creator outstanding ฿100.00. Requesting ฿40.00 cash kept outstanding at ฿100.00 and displayed pending ฿40.00; available additional capacity became ฿60.00. A separate custom-percent browser check showed 99.99% shortage and 100.01% excess and blocked invalid submit. On a seeded bill, a second request above the outstanding amount after reservations produced an inline error. Assigned member chore completion updated state/activity; other-member chores exposed no completion action. Rotation preview followed the selected order, and joining `MINT` opened an empty sample house.

## Runtime and Graft

Actual worker process argv: `codex --no-daemon --dangerously-bypass-approvals-and-sandbox -m gpt-6-sol`. This confirms skip-permission launch for this worker; role profile also configures `approval_policy = "never"` and `sandbox_mode = "danger-full-access"`.

🌱 Graft: **NO_INDEXED_FILES** for frontend initially — `graft --version` returned `0.21.1`; `graft build --no-gitignore --no-ignore` in this worktree indexed only root `neon.ts` (1 file). Raw frontend docs/config were read because there was no indexed frontend source. After scaffold, **ACTIVE** — `graft build --no-gitignore --no-ignore --only-dir ourhoomu-front` indexed 23 source/config files, 96 nodes and 253 edges; final `graft check` returned `OK`. `graft grep --fixed 'fetch(' --in ourhoomu-front` found no indexed app network call. An earlier invalid regex grep and a stale check after formatting were resolved by the final build/check. Graft reported about **21,442 tokens saved across four calls** that emitted a savings figure; no savings are inferred for other calls. `graft/` remains ignored local cache.

## Remaining acceptance and Lead action

This is local UI/demo evidence. iOS native launch, large Dynamic Type/VoiceOver on device, API-backed social login, recipient account policy, private slip access, SlipOK confirmation, LINE delivery and TestFlight remain unproven and belong to later tickets. The host lacks `simctl`, so no native-device claim is made. Tech Lead should obtain independent review, integrate the implementation and report commits into the target branch, verify there, and update ticket/checklist status only after acceptance.
