# SW-0032 — Chore calendar feedback

User feedback “ใช้ select date แบบสวยงาม” is implemented on `/chore/new`: the text input becomes a cream/mint calendar trigger with a Thai date, month navigation, selected/today indicators and a today shortcut. The bounded inline calendar works with the existing Expo/React Native controls and requires no dependency. Selection preserves the `YYYY-MM-DD` contract used by manual, repeat and rotation previews and local creation.

Accepted source: `e2edcb7b237d79630c1a801f36101990973ff6ec`, source baseline `2199fafdec7cb897a0c368fcb66594d7e97b15cb`; target `local`. Source ownership is four frontend files. Independent review found one P2: React Native Web drops nested accessibility state. A two-line correction adds direct trigger `aria-expanded` and a selected-day accessible label. Lead independently reviewed that correction and the fresh Chrome state checks pass. Keyboard operation passed in real Chrome; initial Orca keypress observations were an automation limitation.

| Verification on accepted source | Evidence |
| --- | --- |
| Tests / TypeScript / formatting | 7 tests, 31 assertions, zero failures; typecheck and format exit 0 |
| Date math | Leap dates, Gregorian validity, week alignment and year boundaries; independent UTC/Bangkok/Los Angeles runs pass |
| Expo exports | Web with 15 routes and iOS JavaScript/Hermes export exit 0 |
| Fresh Chrome | Enter/Space, close/reopen, focus return, month lengths, December/January, today and expanded/selected semantics pass |
| Responsive | Seven columns fit at 320×568, 393×852 and 1079×863; day controls retain at least 44px height |
| Creation regression | Selected `2026-10-14` appears in preview and saved week list for all three modes |
| Runtime | Zero application page exceptions/warnings; existing development favicon 404 is cosmetic |

Screenshots: [mobile calendar](assets/sw-0032-calendar-393.png), [desktop calendar](assets/sw-0032-calendar-1079.png).

Orca `/usr/local/bin/orca`, Run `run_b33c97971bc2`: frontend `ctx_aa6d2a5a3f1f`, independent review `ctx_b2b79effb6c0`, correction `ctx_871639f7f8e6`. Each settled successfully, its report was retained, and its terminal was released/captured before acknowledgement. Review verdict initially requested changes; the bounded correction is accepted after Lead re-review and Chrome verification. Frontend processes use verified `gpt-6-sol` and bypass flag; reviewer inherited configuration with a verified bypass flag.

Graft ACTIVE 0.21.1 in exact worktree, final `graft check` OK. Tool-reported retrieval estimates: Lead 19,682 across four calls, initial frontend 46,852 across eight, reviewer 17,202 across three, correction 3,740 across two. These compare retrieval output with full source reads and are not measured model usage.

Durable runtime reports, Chrome JSON/scripts and lifecycle receipts are retained in root `.git/ourhoomu-snapshots/sw-0032/`. Integration and cleanup evidence follows in the ticket and final audit. Root user edits in `docs/team/agent-guide.md` and untracked root `bun.lock` are outside ownership and preserved. Native device/VoiceOver/Dynamic Type and backend/production acceptance remain on their existing tickets; iOS export proves JavaScript only.

Integrated verification: fast-forward `local` from `2199faf` to `6dfce71`; fresh root typecheck, formatting, 7 tests/31 assertions and strict Chrome smoke on port 8081 all pass. The eight checks cover responsive layouts, real keyboard/focus, accessible state, date navigation and all three saved chore modes. Root Graft build/check confirms 26 files/110 nodes/293 edges. Following commits update documentation only. Final source-worktree removal and inventory are recorded in permanent `final-delivery.json` after this documentation checkpoint is merged; the main preview remains on port 8081.
