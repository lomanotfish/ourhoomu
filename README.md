# OurHoomu

แอพบริหารบ้านสำหรับ iPhone: หารค่าใช้จ่ายและทยอยจ่ายคืนคนออกเงิน จัดเวรงานบ้าน และติดตามสิ่งที่ต้องทำในแอป รองรับสมาชิกที่อยู่หลายบ้าน เริ่มต้นไม่เกิน 10 คน

**สถานะ: มี frontend Expo สำหรับลอง flow ด้วยข้อมูลตัวอย่าง และตั้งค่า Neon แล้ว; API และการเชื่อมข้อมูลจริงยังไม่พร้อม** การแจกช่วงแรกใช้ TestFlight เมื่อ native/API acceptance ผ่าน

## โครงสร้าง monorepo

- [ourhoomu-api/](ourhoomu-api/README.md): ขอบเขต backend — API, authentication, PostgreSQL, private slip storage และงานลบประวัติ
- [ourhoomu-front/](ourhoomu-front/README.md): ขอบเขต frontend — แอพ iOS ด้วย Expo / React Native
- [docs/](docs/README.md): requirement, แบบระบบ, API, UX และการเปรียบเทียบผู้ตรวจสลิป
- [checklist.md](checklist.md): ความคืบหน้าและหลักฐานตรวจรับ อัปเดตโดย Tech Lead
- [docs/team/board.md](docs/team/board.md): tickets, dependencies และ checkpoint สำหรับทำงานต่อ

Stack ที่ผู้ใช้เลือก: **React Native + Expo**, **Elysia บน Cloudflare Workers Free**, **Neon PostgreSQL + Drizzle ORM** และ **Bun สำหรับ dependencies/scripts ทั้ง front/back** ดู [MVP spec](docs/project/spec.md) และ [ADR-0003](docs/adr/0003-selected-stack.md) Neon project ourhoomu (`lucky-bar-14515304`) branch `production` มี Object Storage bucket `slip` แบบ private ตาม [neon.ts](neon.ts) API/DTO contract0.3.2 ตรึงสำหรับ core local/dev แล้ว; การพิสูจน์ Google/Apple login จริงยัง pending

เริ่มอ่าน [requirement](docs/team/requirements.md) → [MVP spec](docs/project/spec.md) → [คำตัดสินที่ยังรอ](docs/project/decisions.md) → [checklist](checklist.md)

## ค่าใช้จ่าย

ตรวจ plan/usage ของ Neon ใน Console ก่อนเปิด pilot; การ link/deploy สำเร็จไม่ได้รับรองค่าใช้จ่ายรวมเป็นศูนย์ ส่วน Apple Developer Program สำหรับ TestFlight $99/ปี และ API ตรวจสลิปเป็นต้นทุนแยก ดู [hosting](docs/project/operations.md) และ [เปรียบเทียบ API](docs/project/slip-providers.md)

## การตรวจ repo ในระยะออกแบบ

```sh
git status --short
git diff --check
git ls-files
```

Root package.json/package-lock.json มีเฉพาะ Neon config tooling ที่ CLI ติดตั้ง ใช้ `npm ci` เพื่อติดตั้งตาม lockfile. Frontend เป็นแพ็กเกจแยกพร้อม `bun.lock`: เข้า `ourhoomu-front/` แล้วรัน `bun install --frozen-lockfile`, `bun run web` หรือ `bun run ios`, `bun run typecheck`, `bun run test`, `bun run export:web` และ `bun run export:ios`. ดูข้อกำหนด runtime และขอบเขตเดโมใน [frontend README](ourhoomu-front/README.md); คำสั่ง Neon อยู่ใน [Neon setup](docs/project/neon-setup.md).

API runtime foundation ใช้ Bun 1.4.3 ขึ้นไปและ Node.js 22 ขึ้นไป: เข้า `ourhoomu-api/` แล้วรัน `bun install --frozen-lockfile`, `bun run dev`, `bun run format:check`, `bun run lint`, `bun run typecheck` และ `bun run test`. ขณะ Wrangler รัน ใช้ `bun run check:runtime` ในอีก terminal เพื่อตรวจ health และ route isolation. Build ใช้ `bunx wrangler deploy --dry-run --config wrangler.jsonc --outdir /tmp/ourhoomu-api-dryrun`. มีเฉพาะ health; domain endpoints กำลังพัฒนาตาม contract. วิธีพิสูจน์ Neon กับข้อมูลสังเคราะห์อยู่ใน [API README](ourhoomu-api/README.md).
