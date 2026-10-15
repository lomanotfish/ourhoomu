# OurHoomu checklist

อัปเดต: 2026-10-15 · **ระยะปัจจุบัน: core local/dev ได้รับอนุมัติ; API foundation/contract/transport ตรวจรับแล้ว; database อยู่ระหว่างแก้ผล review; Playwright demo/workerd ผ่านแล้ว**

Tech Lead เท่านั้นอัปเดตหลังตรวจรับและรวมงาน ใส่ ticket/หลักฐานจริงทุกครั้ง [x] หมายถึงผลลัพธ์ในข้อนั้นเสร็จ ไม่ได้หมายความว่าฟีเจอร์แอพเสร็จ ดู [board](docs/team/board.md) และ [requirement acceptance](docs/team/requirements.md)

## 0. เก็บ requirement และออกแบบ — SW-0002

- [x] ยืนยันว่ารอบนี้เอกสารก่อนพัฒนา และ agent ถาม/สรุป/รอยืนยันก่อนเริ่ม — [requirements](docs/team/requirements.md)
- [x] เลือก TestFlight สำหรับช่วงแรก — [decisions](docs/project/decisions.md)
- [x] รวบรวม flow เงิน/ทยอยจ่าย/สิทธิ์สลิป/เวร/แจ้งในแอป/retention จากคำตอบผู้ใช้ — [requirements](docs/team/requirements.md)
- [x] สร้างพื้นที่ ourhoomu-api และ ourhoomu-front แบบเอกสารใน repo เดียว — [backend](ourhoomu-api/README.md), [frontend](ourhoomu-front/README.md)
- [x] เสนอ stack และค่าใช้จ่าย/free-tier limits — [architecture](docs/project/architecture.md), [operations](docs/project/operations.md)
- [x] เปรียบเทียบ Slip2Go / EasySlip / SlipOK พร้อม sources และเงื่อนไขรอยืนยัน — [comparison](docs/project/slip-providers.md)
- [x] ออกแบบ domain/schema/API/UX และเขียนกติกา agents — [docs index](docs/README.md)
- [x] สร้าง tickets พร้อม owner/dependencies/acceptance — [board](docs/team/board.md)
- [x] ตรวจแบบโดย reviewer อิสระและแก้ findings — [SW-0002 resolution](docs/team/reports/SW-0002-resolution.md)
- [x] ตรวจเอกสารหลังรวมและ release reviewer — [SW-0002 integrated checks/cleanup records](docs/team/tickets/SW-0002.md)
- [ ] ผู้ใช้ตรวจและยืนยัน design v0.1 ก่อน implementation — [pending decisions](docs/project/decisions.md)
- [x] ผู้ใช้เลือก SlipOK และปรับเอกสาร/งานที่เกี่ยวข้อง — [SW-0016](docs/team/tickets/SW-0016.md)
- [ ] SlipOK credentials/งบ พร้อมหลักฐาน multi-recipient matching และ retention gate — [provider decision](docs/project/slip-providers.md)

## 1. Foundation

### Neon setup ที่ผู้ใช้อนุญาต — SW-0015

- [x] ติดตั้ง Neon CLI และ login ผ่าน browser
- [x] ติดตั้ง project skills และ global MCP ตามคำสั่ง
- [x] Link lucky-bar-14515304 branch production และตรวจ region/target
- [x] neon.ts ตรงตัวอย่าง private slip bucket; plan/deploy exit 0 และ remote slip access=private
- [x] ปรับ active design จาก Supabase เป็น Neon — [ADR-0002](docs/adr/0002-neon.md), [setup report](docs/project/neon-setup.md)
- [x] ตรวจ root config/dependencies/secrets และรวมงาน — [SW-0015](docs/team/tickets/SW-0015.md)

### Application foundation ที่อนุมัติแล้วสำหรับ local/dev

- [x] SW-0019: ออกแบบ PostgreSQL 29 ตาราง พร้อม ERD/data dictionary/constraints/indexes/transactions/retention และตรวจรวมเอกสาร — [database](docs/project/database.md)
- [x] SW-0020: บันทึก stack Elysia/Cloudflare Workers Free + Drizzle/PostgreSQL + React Native/Expo/Bun tooling — [ticket](docs/team/tickets/SW-0020.md); local `9349182`, 208 ลิงก์ภายในผ่าน
- [x] SW-0021: รวม MVP spec/backlog และตรวจ links/dependency graph หลังรวม — integrated `local` ที่ `749f43e`; 289 local links, 23-ticket dependency/status audit และ cleanup receipt — [spec](docs/project/spec.md), [ticket](docs/team/tickets/SW-0021.md)
- SW-0025 cancelled: ผู้ใช้ให้เริ่ม frontend โดยไม่รอ Figma; partial artifact เก็บเป็นประวัติ — [ticket](docs/team/tickets/SW-0025.md)
- [x] SW-0022: ตรวจ Elysia Workers/Drizzle Neon transaction feasibility — [ticket](docs/team/tickets/SW-0022.md)
- [x] SW-0024: วิจัย Google/Apple session/Neon actor contract (live native proof ยัง pending) — [ticket](docs/team/tickets/SW-0024.md)
- [x] ยืนยัน core local/dev policy และค่าปฏิบัติการตาม [core scope](docs/team/core-implementation.md); provider replay precision/LINE binding/live issuer คง gate เฉพาะงาน

- [x] SW-0003: API foundation/toolchain accepted; existing Expo demo retained. CI expansion not required; native startup proof remains SW-0009.
- [ ] SW-0004: Schema/RLS/RPC, transaction และ generated contract ผ่าน
- [ ] SW-0005: Google/Apple session ผ่าน API, บ้าน/คำเชิญ/บัญชีรับเงิน
- [ ] SW-0009: iOS login/0-1-many houses/invite/navigation ต่อ API จริง

## 2. บิลและการจ่าย

- [ ] SW-0006: หารเปอร์เซ็นต์ครบ 100 ยอดสตางค์ตรง recipient self-covered งวดเงินสดและ idempotency
- [ ] SW-0007: API ตรวจสลิปจริง, private upload/read, duplicate/delay/quota/reconcile
- [ ] SW-0010: UI สร้างบิล/ทยอยจ่าย/เงินสด/ประวัติ/สิทธิ์ภาพ ผ่านบน iPhone

## 3. เวรและกิจกรรม

### LINE OA แจ้งยืนยันการจ่ายเงิน

- [x] SW-0017: บันทึก requirement/design LINE OA และตรวจรวมเอกสาร — [design](docs/project/line-oa.md), [ticket](docs/team/tickets/SW-0017.md)
- [ ] ยืนยันผู้รับ LINE/ข้อความ/binding และ retention ของสำเนาใน LINE
- [ ] ผู้ใช้ตั้ง Channel ID/Channel secret/long-lived access token ใน backend secret store
- [ ] SW-0018: outbox/push/retries และ webhook/binding ตามผู้รับที่ยืนยัน ทดสอบจริงหลัง credentials พร้อม

### เวรและกิจกรรมภายในแอป

- [ ] SW-0008: API จัดเอง/ทำซ้ำ/หมุนอัตโนมัติ, completion และ feed
- [ ] SW-0011: UI เวร/preview/in-app badges/foreground refresh ไม่มี system notifications

## 4. Retention, acceptance และ pilot

- [ ] SW-0013: ลบประวัติทุกประเภทตาม created_at รวม files/child/cache/logs/provider/backup และ restore จริง
- [x] SW-0023: ตรวจ Free tier scheduler/retention feasibility ก่อน SW-0007/0013 — [ticket](docs/team/tickets/SW-0023.md)
- [ ] SW-0012: Independent pre-release QA/security AC1a และ AC2–AC7 บน integrated SHA ผ่าน; AC1b รอ TestFlight
- [ ] SW-0014: Apple/Expo/Google credentials และอนุญาต upload ภายนอกพร้อม
- [ ] SW-0014: ปิด AC1b ด้วย TestFlight build/review/ติดตั้งและ smoke จริง พร้อมแผนอัปเดตก่อน 90 วัน

## บันทึกตรวจรับ

| วันที่ | Ticket | ผล / หลักฐาน |
|---|---|---|
| 2026-10-12 | SW-0002 | เอกสารรวม main/local ที่ f2782fa แล้ว; review/แก้ F1–F3, 146 local links/13 tickets/whitespace ผ่าน; reviewer released — [หลักฐาน](docs/team/tickets/SW-0002.md) |
| 2026-10-12 | SW-0015 | Neon setup/deploy exit0, production/private slip ตรวจจริง; config/lockfile/secret exclusion/172 links ผ่าน; รวม main/local ที่ f333bf4 — [หลักฐาน](docs/team/tickets/SW-0015.md) |
| 2026-10-12 | SW-0021 | MVP spec/backlog รวม `local` ที่ `749f43e`; 50 tracked Markdown files/289 links ผ่าน, ticket/dependency/status audit 23/23 ผ่าน; cleanup receipt — [หลักฐาน](docs/team/tickets/SW-0021.md) |
| 2026-10-13 | SW-0026–0031 | Frontend local demo รวมที่ source `97eaa6e`; independent approve, typecheck/format/3 tests/19 assertions/SDK compatibility/web+iOS JS exports และ 320/393px smoke ผ่าน; release/cleanup พร้อม receipts — [หลักฐาน](docs/team/reports/SW-0027-integration.md) |

## วิธีอัปเดตเมื่อ agent ส่งงาน

Tech Lead ตรวจ artifact กับ acceptance และ required checks → รวมเข้า target → ตรวจผลรวม → อัปเดต ticket/board/checklist พร้อม commit/report/คำสั่งผลจริง เก็บ blocker พร้อม owner/next action งานที่ไม่ผ่านคง unchecked ผู้ใช้อนุญาต frontend เพิ่มโดยตรงแล้วตาม SW-0027; API/production integration ยังต้องผ่าน scope และ prerequisites ของ tickets เดิม

## Frontend รอบที่อนุญาตล่าสุด — SW-0026–0031

- [x] SW-0026: Visual/motion/flow contract ใน repo โดยไม่รอ Figma — [contract](docs/project/frontend-design.md), [Lead acceptance](docs/team/tickets/SW-0026.md)
- [x] SW-0027: Expo mobile app ธีมน่ารัก, four tabs, demo bills/chores/house flows และ animation/reduced motion — [รายงาน frontend](docs/team/reports/SW-0027-frontend.md)
- [x] SW-0028: Independent review approve, integrated checks และ worker/source worktree cleanup — [ผลรวม](docs/team/reports/SW-0027-integration.md)
- [x] SW-0029/30/31: Plain UI copy, reduced-motion held-press reset, 44pt filters และ empty-status rendering — [ผลรวม](docs/team/reports/SW-0027-integration.md)
- [x] SW-0032: ปฏิทินธีมมิ้นต์/ครีมแทนช่องวันที่ทำ; keyboard/ARIA, 320/393/1079px และสร้างเวรครบสามโหมดผ่านบน `local` ที่ `6dfce71`; 7 tests/31 assertions, typecheck/format และ web/iOS JS exports ผ่าน — [หลักฐาน](docs/team/reports/SW-0032-chore-date.md)

Frontend demo ไม่ใช้ปิดการตรวจ API/social login/SlipOK/LINE/retention/TestFlight ของ tickets เดิม.

## Backend planning — 2026-10-13

- [x] SW-0033 backend tasks/dependencies/ownership/API-to-frontend handoffs prepared; research22/23/24, FE plan34 and independent35 review accepted, final approve60e3292 after fixa3bc4a4. [Plan](docs/team/backend-plan.md) / [delivery evidence](docs/team/reports/SW-0033-backend-plan-delivery.md).
- [x] User confirmed core local/dev implementation; [approved scope](docs/team/core-implementation.md). SW-0036 contract7756bcc accepted with independent review and generated frontend DTOs; SW-0037 owns gated provider/retention extensions.
- [x] SW-0038 bounded Elysia/workerd/Neon transaction proof accepted on local `d9beb90`: restricted actor RLS, rollback and context isolation; independent review closed all findings, fresh root 6 tests/15 assertions/typecheck/workerd checks pass. [Evidence](docs/team/reports/SW-0038-runtime-proof.md), [final review](docs/team/reports/SW-0041-runtime-final.md). Full domain foundation and native/provider acceptance remain pending.
- [ ] Actual backend/API/native/provider/retention/release acceptance remains pending in original tickets; research and mock do not close those criteria.

- [x] SW-0042: DTOs generated from accepted0.3.2 contract; strict TypeScript/format/reproducibility checks pass. Real API integration remains pending.

- [x] SW-0044: portable typed client and session race boundary accepted; 41 full tests/165 assertions and independent review pass. Actual API/native integration remains SW-0009 pending.


## Continued delivery — 2026-10-15

- [x] SW-0036/0039: accepted OpenAPI7756bcc and independent contract review; SW-0042 generated frontend DTO consumer — [board](docs/team/board.md).
- [x] SW-0038/0041/0043: Workers/Neon runtime proof and API quality hooks accepted; live issuer/provider/native acceptance remains separate.
- [x] SW-0044/0045: typed frontend transport/session authority integrated and independently approved. Fresh local frontend41tests165assertions, API8tests26assertions, typecheck/format/API lint pass on dc0e908.
- [ ] SW-0004/0046: core schema, restricted roles and atomic operations await independent review/integration.
- [x] SW-0047: Playwright actual demo browser and local workerd API suite integrated; 24/24 pass, zero skip/flaky. Real feature/native gates remain pending.
- [ ] SW-0005/0006/0008 and SW-0009/0010sliceA/0011: actual core handlers and UI/API integration.
- [ ] Live Google/Apple/native, SlipOK, LINE, full retention and TestFlight gates require their original evidence/credentials/authorization.
