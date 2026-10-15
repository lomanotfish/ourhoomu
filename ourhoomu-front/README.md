# OurHoomu frontend

React Native + Expo Router app สำหรับ iOS และ web preview. ตอนนี้เปิด **บ้านตัวอย่างในเครื่อง** ได้ มีภาพรวม บิล เวร บ้านและสมาชิก พร้อม animation แบบลดการเคลื่อนไหวได้ ข้อมูลตัวอย่างเริ่มใหม่เมื่อรีโหลด/ปิดแอป และไม่แตะ Neon, API, บัญชีธนาคาร, SlipOK หรือ LINE

## เวอร์ชันที่ตรวจแล้ว (2026-10-12)

| Tool / package | Version |
|---|---|
| Node.js LTS บนเครื่องที่ตรวจ | 24.15.0 |
| Bun | 1.4.3 |
| Expo SDK | 57.0.28 |
| Expo Router | 57.0.26 |
| React / React DOM | 19.2.3 |
| React Native / React Native Web | 0.86.3 / 0.21.4 |
| TypeScript | 6.0.3 |

เลือก Expo SDK 57 stable จาก [Expo SDK matrix](https://docs.expo.dev/versions/latest/) และ npm `latest` ณ วันที่ข้างต้น ใช้ `bun expo install` เลือกเวอร์ชัน native modules ที่ Expo รองรับ และ `bun expo install --check` ยืนยัน dependency compatibility. Node.js ยังจำเป็นตาม [Expo Bun guide](https://docs.expo.dev/guides/using-bun/). ฟอนต์ `assets/fonts/NotoSansThai.ttf` bundle สำหรับใช้งาน offline ภายใต้ [SIL Open Font License](assets/fonts/OFL.txt).

## Workspace setup

Install once from the repository root with `bun install --frozen-lockfile`
using Bun 1.4.3 and Node.js 24.15.0. The isolated workspace retains frontend
TypeScript 6.0.3. Then run app scripts from this directory:

```sh
cd ourhoomu-front
bun run start          # Expo dev server; กด i สำหรับ iOS Simulator หรือ w สำหรับ web
bun run ios            # ต้องมี Xcode และ iOS Simulator
bun run web            # web preview
bun run typecheck
bun run test           # invariant ของเงินตัวอย่าง
bun run format:check   # Prettier check
bun expo install --check
bun run export:web     # สร้าง dist/web/ สำหรับ browser
bun run export:ios     # ตรวจ/ส่งออก iOS JavaScript bundle ไม่ใช่ native build
```

One root `bun.lock` installs both apps and `packages/*`; root Neon tooling is
retained in the same workspace. App/root old lockfiles are superseded. Generated
`node_modules/`, `.expo/`, `dist/`, `.turbo/` and `expo-env.d.ts` stay ignored.
Web exports go to `dist/web/`, iOS JavaScript exports to `dist/ios/`, so the tasks
can run independently. Exports use standard Expo production dotenv precedence:
`.env.production.local`, `.env.local`, `.env.production`, then `.env`; explicit
caller environment values take precedence. Turbo hashes app `.env` and `.env.*`
files even when ignored, plus caller `EXPO_PUBLIC_*` values and `NODE_ENV`.
Exports clear Metro transforms when executed so dotenv changes produce fresh
bundles after a Turbo cache miss. Keep secrets out of public environment
variables and exported bundles.

The existing `src/api/dto.ts` is a compatibility type re-export from
`@ourhoomu/contracts`. See [contracts](../packages/contracts/README.md) for the
frozen OpenAPI schema and generation. Expo SDK 57's default Metro monorepo
support is used without custom watch folders or resolver overrides.

## ลอง flow

1. กด **ลองบ้านตัวอย่าง** ที่หน้าเริ่มต้น. Google/Apple ยังไม่เชื่อม จึงไม่มีปุ่มเข้าสู่ระบบที่แสร้งว่าสำเร็จ.
2. ภาพรวมแสดงยอดค้าง ยอดรอรับ เวรวันนี้ และกิจกรรม. หัวบ้านสลับบ้านได้; หน้า **บ้าน** มีสมาชิก สร้างบ้านใหม่ และเข้าร่วมด้วยรหัสตัวอย่าง `MINT`.
3. สร้างบิลโดยเลือกผู้รับเงิน ผู้หาร และหารเท่ากันหรือกำหนดเปอร์เซ็นต์. พรีวิวคิดเงินเป็นจำนวนเต็มสตางค์/เปอร์เซ็นต์ bps และแจกเศษแบบ largest remainder. ส่วนของผู้รับเงินนับออกเองเฉพาะเมื่อเป็นผู้หาร. ลองยอด ฿200.00 หาร 50/50 และเลือกอีกคนเป็นผู้รับเงิน.
4. ในรายละเอียดบิล แจ้งจ่าย ฿40.00 แบบเงินสดหรือโอนตัวอย่าง. สถานะจะรอ และยอดค้างเดิมไม่ลด; คำขอจะกันวงเงินอีก ฿40.00 ไว้. ถอนคำขอที่รออยู่ได้. ไม่มีการยืนยันเงินหรือส่งสลิปจริง.
5. หน้า **เวร** เลือกวันนี้/สัปดาห์/วันที่, ทำเวรของมิวให้เสร็จ, แล้วดูกิจกรรมที่เปลี่ยน. สร้างงานครั้งเดียว ทำซ้ำ หรือหมุนเวียน พร้อมพรีวิว 14 วัน.

Google/Apple session, recipient accounts, invitation tokens, payment confirmation, private slip upload/view, notifications, LINE OA และการลบข้อมูลจริงรอ API/native integration tickets. แอพเดโมไม่ขอ notification permission และไม่เรียก production network. `export:ios` พิสูจน์เฉพาะ bundle; ยังต้องทดสอบ Xcode/iPhone, OAuth, API และ TestFlight ภายหลัง.

## Playwright browser and HTTP acceptance

Playwright Test is pinned to `1.64.1` (official npm registry checked 2026-10-15).
Use Node.js 24 and Bun 1.4.3 with the existing Expo dependencies. Install the workspace from its root lock, then install Playwright's bundled Chromium:

```sh
bun install --frozen-lockfile
cd ourhoomu-front
bun run test:e2e:install
bun run typecheck
bun run typecheck:e2e
bun run format:check
bun run test
bun run test:e2e
```

On Linux CI, install browser system libraries with
`bunx playwright install --with-deps chromium` instead. If the browser download
is slow, use `PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=180000 bun run test:e2e:install`.
No global Playwright, user Chrome profile, API credentials or database is needed.

`playwright.config.ts` owns both local server lifecycles using
[Playwright webServer](https://playwright.dev/docs/test-webserver). Reserve
`localhost:18047` for Expo and `127.0.0.1:18048` for local Wrangler/workerd
(inspector `18049`); `reuseExistingServer: false` rejects existing frontend/API
listeners. Close any conflicting listener yourself or choose a different set of
ports consistently in the config and API test origin. Tests never reuse a user
server. The runner shuts down its process groups after passing, failing or
interruption. Wrangler runs through Node, matching its supported runtime; Bun
continues to run package scripts and the existing 41 unit tests under `src/`.

Browser projects run Chromium at desktop 1280×900 and mobile 390×844 with touch,
using a fresh context per test and Asia/Bangkok timezone. These are **in-memory
demo UI tests**: entry/reset, navigation, exact bill splits and custom percentage
validation, pending partial cash requests/cancellation, all three chore modes,
completion/activity, calendar keyboard/focus/date selection, house selection,
creation/join and observable reduced-motion press transforms. There are no
network mocks or skipped future-login placeholders. Mobile Chromium emulation
does not prove iOS/Hermes/native accessibility or OAuth.

The separate `workerd-api` project uses real
[APIRequestContext](https://playwright.dev/docs/api-testing) HTTP requests against
the existing API production entrypoint running **locally**, asserting health,
request IDs, safe 404 envelopes, hidden fixture routes and configured CORS.
It does not prove database, session, live identity, bills/chores API integration,
SlipOK, LINE, retention or production deployment. Add API-backed browser flows
when their real handlers and frontend wiring land; passing the demo suite does
not satisfy those future acceptance criteria.

Failures retain traces/screenshots and error context in ignored `test-results/`;
HTML is in ignored `playwright-report/`, JSON in `test-results/results.json`.
Use `bun run test:e2e:report` or `bunx playwright show-trace <path-to-trace.zip>`.
Copy evidence you need before another run replaces these directories. Commit
only config/tests/docs/locks, never generated reports or browser state.
