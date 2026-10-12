# OurHoomu checklist

อัปเดต: 2026-10-12 · **ระยะปัจจุบัน: ออกแบบและเอกสาร ยังไม่มีแอพที่รันได้**

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
- [ ] ผู้ใช้เลือก API ตรวจสลิปและงบ; provider ผ่าน retention gate — [comparison](docs/project/slip-providers.md)

## 1. Foundation

- [ ] SW-0003: Monorepo/toolchain/CI และ local app/API รันได้
- [ ] SW-0004: Schema/RLS/RPC, transaction และ generated contract ผ่าน
- [ ] SW-0005: Google/Apple session ผ่าน API, บ้าน/คำเชิญ/บัญชีรับเงิน
- [ ] SW-0009: iOS login/0-1-many houses/invite/navigation ต่อ API จริง

## 2. บิลและการจ่าย

- [ ] SW-0006: หารเปอร์เซ็นต์ครบ 100 ยอดสตางค์ตรง recipient self-covered งวดเงินสดและ idempotency
- [ ] SW-0007: API ตรวจสลิปจริง, private upload/read, duplicate/delay/quota/reconcile
- [ ] SW-0010: UI สร้างบิล/ทยอยจ่าย/เงินสด/ประวัติ/สิทธิ์ภาพ ผ่านบน iPhone

## 3. เวรและกิจกรรม

- [ ] SW-0008: API จัดเอง/ทำซ้ำ/หมุนอัตโนมัติ, completion และ feed
- [ ] SW-0011: UI เวร/preview/in-app badges/foreground refresh ไม่มี system notifications

## 4. Retention, acceptance และ pilot

- [ ] SW-0013: ลบประวัติทุกประเภทตาม created_at รวม files/child/cache/logs/provider/backup และ restore จริง
- [ ] SW-0012: Independent pre-release QA/security AC1a และ AC2–AC7 บน integrated SHA ผ่าน; AC1b รอ TestFlight
- [ ] SW-0014: Apple/Expo/Google credentials และอนุญาต upload ภายนอกพร้อม
- [ ] SW-0014: ปิด AC1b ด้วย TestFlight build/review/ติดตั้งและ smoke จริง พร้อมแผนอัปเดตก่อน 90 วัน

## บันทึกตรวจรับ

| วันที่ | Ticket | ผล / หลักฐาน |
|---|---|---|
| 2026-10-12 | SW-0002 | เอกสารรวม main/local ที่ f2782fa แล้ว; review/แก้ F1–F3, 146 local links/13 tickets/whitespace ผ่าน; reviewer released — [หลักฐาน](docs/team/tickets/SW-0002.md) |

## วิธีอัปเดตเมื่อ agent ส่งงาน

Tech Lead ตรวจ artifact กับ acceptance และ required checks → รวมเข้า target → ตรวจผลรวม → อัปเดต ticket/board/checklist พร้อม commit/report/คำสั่งผลจริง เก็บ blocker พร้อม owner และ next action งานที่ไม่ผ่านคง unchecked ผู้ใช้อนุญาตเอกสารแล้วแต่ยังไม่อนุญาตเริ่มพัฒนา
