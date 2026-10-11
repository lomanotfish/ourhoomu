# OurHoomu

แอพบริหารบ้านสำหรับ iPhone: หารค่าใช้จ่ายและทยอยจ่ายคืนคนออกเงิน จัดเวรงานบ้าน และติดตามสิ่งที่ต้องทำในแอป รองรับสมาชิกที่อยู่หลายบ้าน เริ่มต้นไม่เกิน 10 คน

**สถานะ: ออกแบบและเอกสารเท่านั้น ยังไม่มีแอพหรือ API ที่รันได้** ผู้ใช้ยืนยันให้ตรวจแบบก่อนเริ่มพัฒนา การแจกช่วงแรกใช้ TestFlight

## โครงสร้าง monorepo

- [ourhoomu-api/](ourhoomu-api/README.md): ขอบเขต backend — API, authentication, PostgreSQL, private slip storage และงานลบประวัติ
- [ourhoomu-front/](ourhoomu-front/README.md): ขอบเขต frontend — แอพ iOS ด้วย Expo / React Native
- [docs/](docs/README.md): requirement, แบบระบบ, API, UX และการเปรียบเทียบผู้ตรวจสลิป
- [checklist.md](checklist.md): ความคืบหน้าและหลักฐานตรวจรับ อัปเดตโดย Tech Lead
- [docs/team/board.md](docs/team/board.md): tickets, dependencies และ checkpoint สำหรับทำงานต่อ

Stack ที่เสนอ: TypeScript, Expo / React Native / Expo Router, Supabase Edge Functions (Deno), PostgreSQL, Supabase Auth และ Storage ใช้ API ภายนอกตรวจสลิปผ่าน backend

เริ่มอ่าน [requirement](docs/team/requirements.md) → [architecture](docs/project/architecture.md) → [คำตัดสินที่ยังรอ](docs/project/decisions.md) → [checklist](checklist.md)

## ค่าใช้จ่าย

Hosting เริ่มที่ $0 ได้ภายใน free tier ของ Supabase ส่วน Apple Developer Program สำหรับ TestFlight ปัจจุบัน $99/ปี และ API ตรวจสลิปเป็นต้นทุนแยก ดูราคา เงื่อนไข และแหล่งข้อมูลใน [hosting](docs/project/operations.md) และ [เปรียบเทียบ API](docs/project/slip-providers.md) ตรวจข้อมูลเมื่อ 2026-10-12

## การตรวจ repo ในระยะออกแบบ

```sh
git status --short
git diff --check
git ls-files
```

ยังไม่มี package manifest, dependency, build, lint, test หรือคำสั่งเปิดแอพ เมื่อเริ่ม ticket ตั้งค่าโครงการ ต้องเพิ่มคำสั่งที่ใช้งานได้จริงและ pin เวอร์ชันที่เข้ากันไว้พร้อม lockfile
