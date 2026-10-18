# OurHoomu frontend design contract — SW-0026

Revision 1 · 2026-10-12 · React Native + Expo frontend demo · No Figma dependency

Build a warm, useful shared-home app: the first screen answers “what do I owe, and what is my chore today?” Cream, peach and mint support that hierarchy; decoration stays secondary. This contract supplies visual and interaction choices for [SW-0027](../team/tickets/SW-0027.md), within the latest [frontend authorization](../team/requirements.md). [UX](ux.md), [spec](spec.md) and [domain](domain.md) remain the behavior references; pending [product decisions](decisions.md) remain pending beyond the demo.

## Visual system

Keep raw values in primitives, purpose aliases in semantic tokens and component defaults referring to those aliases. The names below are suggested TypeScript token keys, not a requirement to create extra packages.

| Semantic token | Primitive value | Use |
|---|---|---|
| `surface.canvas` | cream `#FFF8F0` | Screen background and safe areas |
| `surface.card` | paper `#FFFFFF` | Forms, bill/chore rows and sheets |
| `surface.warm` | peach `#FFE0CE` | Main balance card, selected tab capsule |
| `surface.calm` | mint `#DDEDE4` | Chores and confirmed state |
| `surface.cool` | soft blue `#DDEBF3` | Household/member grouping |
| `text.primary` | cocoa `#443027` | Titles, body, amounts and essential icons |
| `text.secondary` | muted cocoa `#765C51` | Supporting copy and inactive tab labels |
| `action.primary` | deep coral `#B94D36` | Main CTA, selected icon and focus outline |
| `action.onPrimary` | paper `#FFFFFF` | Label on coral button |
| `status.pending.bg` / `.ink` | `#FFF0CF` / `#7A5318` | Clock + “รอตรวจ” or “รอยืนยันเงินสด” |
| `status.confirmed.bg` / `.ink` | mint / `#2F604B` | Check + “ยืนยันแล้ว” |
| `status.error.bg` / `.ink` | peach / cocoa | Precise validation/rejection; coral icon/border |
| `border.control` | `#98786A` | Input boundary and unchecked controls |
| `border.decorative` | `#E8D8CD` | Card separator; never the only control affordance |

Body-text target is at least 4.5:1; essential control boundaries at least 3:1. Calculated pairs: primary/cream 11.74:1, secondary/white 6.14:1, white/coral 5.03:1, pending ink/background 6.05:1, confirmed ink/mint 5.98:1, coral/peach 4.02:1 and control border/white 4.02:1. Use cocoa on peach error chips; reserve coral for their icon/border or use coral text on white. Recheck actual composites, opacity and custom states in the implementation.

Typography: use **Noto Sans Thai**, bundled locally by the frontend owner, weights 400/500/600/700; Thai-capable system fallback while loading. Body 17, field/row label 16, section title 20, screen title 26, hero amount 32, supporting copy 14 and tab label 12 logical points at default text size. Use roughly 1.45× line height for Thai, including titles, and real weight files rather than synthetic bold. Amounts use two decimal places (`฿100.00`) with stable digit alignment; give VoiceOver an amount in baht. Font scaling stays enabled for labels and amounts.

Spacing primitives: 4/8/12/16/24/32 logical points. Semantic defaults: screen gutter 20 (16 at narrow widths), card padding 20, row gap 12, section gap 24. Radii: field/button 16, card 24, sheet top corners 28, badge capsule fully rounded. A restrained cocoa shadow (about 6% opacity, 2pt offset, 8pt blur) separates important cards; avoid a shadow on every row. Use generous blank cream between groups.

Illustration: a bespoke little cream house with an asymmetrical peach roof, cocoa door/window strokes, two mint leaves in a terracotta pot, and a small blue cloud. Reuse that visual family as a receipt with a leaf, a broom beside a plant, and two pots for members. Use simple original vector shapes with rounded 2pt strokes, rather than emoji or stock decoration. Hero art occupies about 80–112pt and never sits behind text; empty-state art about 72pt. Icons share rounded 2pt strokes, 22–24pt visible size and labeled touch areas. Decorative art is hidden from accessibility.

## Navigation and component anatomy

Four persistent tabs: **ภาพรวม / บิล / เวร / บ้าน** (house, receipt, broom, members icons). Active tab gets peach capsule, coral icon and selected accessibility state; each tab keeps its visible label. A compact header contains the active house name as a switcher and a labeled activity button. Settings lives under บ้าน. Details/forms use a back/close header; return preserves tab, scroll and selected date.

| Component | Anatomy and interaction |
|---|---|
| Balance card | Small “ฉันยังต้องจ่าย” label → large amount → due/context line → “ดูบิลที่ต้องจ่าย”; little house art beside, never over the amount. Pending is a separate labeled row, not a deduction or success bar. |
| Bill row | Receipt tile → title/recipient/due date → amount + text/icon status. Entire row opens detail; disclosure arrow is decorative. Show pending and overdue separately where both apply. |
| Chore row | Broom/plant tile → task/assignee/date → labeled completion action only for current assignee. Other people’s rows show their state. No nested action inside another pressable. |
| Primary button | Coral fill/white label, minimum 52pt height, flexible height at large text. Pressed scale 0.98 plus darker overlay; disabled uses opaque neutral surface and explanatory text. Busy keeps label + spinner and prevents repeated submit. |
| Form field | Persistent label → input with visible boundary → helper/error. Never placeholder-only. THB/% use decimal input; support scroll above keyboard and a visible Done/submit action. First invalid field receives focus and an accessible error announcement. |
| Sheet/status feedback | Cream sheet with title, explicit close, scrollable body and clear final action. Dimmed backdrop; dismissal preserves an unfinished draft, with confirmation before discarding changed data. Status always combines label with icon; brief toast repeats the result without replacing it. |

Overview order, within one scrollable screen:

```text
บ้านละมุน ▾                          กิจกรรม (2)
ข้อมูลตัวอย่าง • ใช้งานในเครื่องนี้
สวัสดี มายด์                 [little house]
[ ฉันยังต้องจ่าย  ฿100.00   ดูบิลที่ต้องจ่าย ]
[ รอตรวจ ฿40.00 • ยังไม่หักยอดค้าง ]
[ คนอื่นต้องคืนฉัน ฿250.00 ]
เวรของฉันวันนี้                 ดูทั้งหมด
[ รดน้ำต้นไม้ • วันนี้ • ทำเสร็จ ]
ความเคลื่อนไหวล่าสุด            ดูกิจกรรม
ภาพรวม       บิล       เวร       บ้าน
```

Every overview metric and “ดูทั้งหมด” opens its relevant list/filter; avoid decorative dead buttons. Completed chores move below unfinished chores without abruptly removing focus. Activity is a short readable list of changes, with pending items leading to the correct detail. Show all-clear copy when there is no debt or chore instead of an empty metric grid.

## Essential demo flows

The entry and persistent in-app strip say **“ข้อมูลตัวอย่าง • ใช้งานในเครื่องนี้”**. Entry explains **“ลองจัดบิลและเวรด้วยข้อมูลตัวอย่าง ยังไม่เชื่อมบัญชีจริง”**, offers **“ลองใช้บ้านตัวอย่าง”**, and identifies Google/Apple as forthcoming real login rather than successful demo authentication. Auth, invitations and LINE controls disclose their unavailable integration at the action. Use seeded fictional names and masked sample accounts. Current SW-0027 payments create pending local records only; confirmation and slip-image flows belong to future API integration.

| Flow | Implementation contract |
|---|---|
| Entry / house selection | Demo entry opens the seeded home; household switcher can select another seeded home. A no-house state offers create/join forms with explicitly local outcomes. Invite expiry/invalid copy can be demonstrated without creating a real invite or claim of delivery. Never imply a provider session was created. |
| Bills list / create | Show outstanding, pending and completed filters plus visible “สร้างบิล”. Form order: title/THB/due date → recipient (defaults to creator) + masked sample account → participants + equal/custom % → preview. All members can create; choosing another recipient states that they paid the expense first. Missing eligible account blocks publication with “ให้ผู้รับเงินตั้งค่าบัญชีก่อน”; creator cannot edit another person’s account. |
| Split preview / publish | Show total, exact % total, each person’s %/THB, recipient self-covered amount, amounts to return, masked destination and sample deletion date. 99.99%/100.01% produce inline shortage/excess, not a rounded “100%”. Equal thirds show 33.34/33.33/33.33%; sums match the bill. Example: ฿200.00, A/B 50/50, recipient A → “A ออกส่วนของตัวเองแล้ว ฿100.00”, B owes ฿100.00. If recipient is outside participants, their self-covered portion is ฿0.00. Primary action is “สร้างบิลตัวอย่าง”; result opens detail. |
| Bill detail / partial payment | Detail shows title/recipient/destination/due date, responsibility/confirmed paid/outstanding for every participant, pending separately, then installment timeline. “บันทึกการจ่าย” opens amount + transfer/cash choices; entering part of the balance is first-class. Transfer records say “รอตรวจสลิป”; cash submission says “รอผู้สร้างบิลยืนยัน”. Current demo has no simulated provider-verification, cash-approval or slip-upload control. Future cash approval belongs to the creator; slip preview belongs only to uploader/recipient, without extra access for creator/owner. |
| Payment state example | B owes ฿100.00. Submit ฿40.00 pending → outstanding stays ฿100.00; display pending ฿40.00 and available additional amount ฿60.00. Reserved pending amounts prevent another submission exceeding the available amount. For future API acceptance: confirmed ฿40.00 → outstanding ฿60.00; cash ฿60.00 leaves that balance unchanged until creator confirmation → ฿0.00. API rejection releases reservations without credit, and timeout retries the same installment. The current demo never credits pending money or offers a verification simulation. |
| Chores / date / completion | Default to today, with a date strip and today/week view. Selected date has weekday + explicit date, not color alone; keep it visible when switching view. Row includes assignee, incomplete/completed/overdue/unassigned text and due date. Current demo assignee can mark complete; show busy, then simulated success and updated activity. Unassigned stays explicit and leads to schedule editing by an eligible demo role. Completion does not advance rotation. |
| Create schedule | Present จัดเอง / ทำซ้ำ / หมุนอัตโนมัติ as three labeled choices with one-line explanations. Manual: task/date/assignee. Repeat: task/start date/daily or weekly weekdays/fixed assignee. Rotation: task/start date/occurrence weekdays/ordered people; explicit move up/down controls make ordering accessible. Preview the next two weeks with actual dates and names before “บันทึกตารางตัวอย่าง”. Future edits preserve completed/history snapshots. These demo choices illustrate existing proposed domain rules, without approving backend policies. |
| House / members / settings | House card + member avatar/name/role list, local create/join and owner invite preview, own masked receiving-account settings and profile/settings rows. Other members’ accounts have no edit affordance. Provide demo reset with confirmation and “กลับหน้าเริ่มต้น”; clarify whether sample edits reset on exit or persist locally. LINE row explains “ยังไม่เชื่อมต่อ”; it cannot claim binding or message delivery. General activity remains in-app; do not request iOS notification permission. |

Use a single compact shared state pattern: static skeleton while initially loading; illustrated empty state with one useful action; inline retryable error retaining input; and persistent result in the destination screen. Stale/unavailable data has explicit text and time, with writes disabled until the data source accepts them. Demo timing and fixtures must remain distinguishable from API results. Deletion dates are illustrative; nothing here proves production retention.

## Motion

Use motion to connect a tap to its result; keep amounts stable while browsing, without rolling counters, perpetual floating art or repeated card entrances. Animate transform/opacity rather than changing text layout every frame. One shared motion configuration is enough; the frontend owner chooses the compatible implementation.

| Interaction | Default motion | Reduced motion |
|---|---|---|
| Press / release | 80ms to scale 0.98; restrained spring to 1 (starting values stiffness 240, damping 24, mass 1; tune for no visible bounce) | Instant color feedback, no scale/spring |
| Tab change | 180ms content fade + at most 6pt vertical displacement; selected capsule changes once | Instant selection, optional fade ≤100ms |
| Detail / sheet | Detail 220ms fade/12pt translation; sheet 280ms ease-out from bottom, 180ms backdrop; close 200ms | No translation; instant or ≤100ms fade |
| First list appearance | 220ms fade/6pt reveal, 35ms stagger for at most first four items; no replay on scroll/refresh | No stagger, no displacement |
| Confirmed payment / chore | Single 240ms check reveal, optional small mint halo fading by 400ms; keep resulting label visible and announce it | Instant check/label, no halo or particles |
| Validation / loading | Inline error fades in 120ms; calm static skeleton and busy control | Instant errors; static skeleton; accessible busy text |

Respect the OS reduced-motion setting on launch and changes during use. Cancel in-flight decorative motion when enabled; no spring, parallax, scaling, stagger or celebratory particles. A fade is optional, never a required wait before the action is usable. Guard repeated submit while an action is pending; success timing never precedes accepted demo/API state. If haptics already exist in the app, use one light completion cue; it is never the only feedback.

## Mobile and accessibility checks for frontend acceptance

- All touch targets, including close, date, checkbox, tab and icon-only activity, are at least **44×44pt**; primary actions at least 52pt high and adjacent targets have breathing room. Long tab labels and large text expand the tab bar instead of clipping.
- Respect top/bottom safe-area insets; tab background extends beneath the home indicator, labels stay above it. Scroll content includes tab/action clearance. Keyboard avoidance keeps amount, error and submit reachable; forms/sheets must scroll rather than relying on a fixed height.
- At a 320pt-wide small iPhone, stack overview secondary metrics and split preview totals vertically; wrap names and helper copy. At large Dynamic Type, move row amounts/actions below text, allow multiline labels, grow controls and scale line heights. Shrink optional art before shrinking text; no horizontal scroll for core tasks.
- VoiceOver reads headings, amount/unit/status, selected dates/tabs and labeled actions in visual order. Checkboxes announce checked state. Modal focus enters the sheet, stays inside, then returns to the opener; successful completion/error has a concise announcement. Controls remain operable with keyboard/switch access where available.
- Walk through the ฿200.00 A/B example and pending ฿40.00; verify labels, reservations and unchanged outstanding. Confirmed ฿40.00 plus cash ฿60.00 remains future API acceptance. Check custom % validation, recipient outside split, private-slip affordances, all three chore modes and completion only by assignee.
- Review on a small screen, large text, VoiceOver and reduced motion; capture actual screenshots/recordings in the frontend acceptance report. This document and calculated contrast are design evidence only: no user interviews, device usability test, native accessibility pass, real authentication, SlipOK verification or LINE delivery is claimed.
