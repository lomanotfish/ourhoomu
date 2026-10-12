# OurHoomu

แอพบริหารบ้านสำหรับ iPhone: หารค่าใช้จ่ายและทยอยจ่ายคืนคนออกเงิน จัดเวรงานบ้าน และติดตามสิ่งที่ต้องทำในแอป รองรับสมาชิกที่อยู่หลายบ้าน เริ่มต้นไม่เกิน 10 คน

**สถานะ: มีเอกสารและตั้งค่า Neon แล้ว ยังไม่มีแอพหรือ API ที่รันได้** ผู้ใช้อนุญาต Neon setup/deploy โดยเฉพาะ งานพัฒนาแอปยังรอตรวจแบบ การแจกช่วงแรกใช้ TestFlight

## โครงสร้าง monorepo

- [ourhoomu-api/](ourhoomu-api/README.md): ขอบเขต backend — API, authentication, PostgreSQL, private slip storage และงานลบประวัติ
- [ourhoomu-front/](ourhoomu-front/README.md): ขอบเขต frontend — แอพ iOS ด้วย Expo / React Native
- [docs/](docs/README.md): requirement, แบบระบบ, API, UX และการเปรียบเทียบผู้ตรวจสลิป
- [checklist.md](checklist.md): ความคืบหน้าและหลักฐานตรวจรับ อัปเดตโดย Tech Lead
- [docs/team/board.md](docs/team/board.md): tickets, dependencies และ checkpoint สำหรับทำงานต่อ

ฐานข้อมูลที่ผู้ใช้เลือก: **Neon PostgreSQL** โปรเจกต์ ourhoomu (`lucky-bar-14515304`) branch `production` และ Object Storage bucket `slip` แบบ private ตาม [neon.ts](neon.ts) ข้อเสนอ frontend ยังเป็น Expo / React Native / TypeScript ส่วน API hosting และ Google/Apple identity provider ต้องปรับ contract ก่อนพัฒนา ดู [ADR-0002](docs/adr/0002-neon.md)

เริ่มอ่าน [requirement](docs/team/requirements.md) → [architecture](docs/project/architecture.md) → [คำตัดสินที่ยังรอ](docs/project/decisions.md) → [checklist](checklist.md)

## ค่าใช้จ่าย

ตรวจ plan/usage ของ Neon ใน Console ก่อนเปิด pilot; การ link/deploy สำเร็จไม่ได้รับรองค่าใช้จ่ายรวมเป็นศูนย์ ส่วน Apple Developer Program สำหรับ TestFlight $99/ปี และ API ตรวจสลิปเป็นต้นทุนแยก ดู [hosting](docs/project/operations.md) และ [เปรียบเทียบ API](docs/project/slip-providers.md)

## การตรวจ repo ในระยะออกแบบ

```sh
git status --short
git diff --check
git ls-files
```

Root package.json/package-lock.json มีเฉพาะ Neon config tooling ที่ CLI ติดตั้ง ใช้ `npm ci` เพื่อติดตั้งตาม lockfile; ไม่มี app build/lint/test หรือ workspace scaffold ดูคำสั่งตั้งค่าและผลตรวจจริงใน [Neon setup](docs/project/neon-setup.md)
