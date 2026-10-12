# ADR-0001: Expo + Supabase ใน monorepo

Date: 2026-10-12
Status: Superseded สำหรับ backend/database โดย [ADR-0002](0002-neon.md) และสำหรับ frontend/tooling/API hosting โดย [ADR-0003](0003-selected-stack.md); เก็บข้อเสนอเดิมนี้เป็นประวัติ ห้ามนำ Supabase-specific setup ไปพัฒนาต่อ

## Context

ต้องการ iOS app สำหรับไม่เกิน 10 ผู้ใช้ เริ่ม hosting ฟรี ดูแลง่าย รองรับ relational data ของหลายบ้าน บิล ผู้หาร งวด และประวัติสลิป การคำนวณเงินต้อง atomic และแยกข้อมูลบ้านได้จริง ผู้ใช้ต้องการ Google/Apple login ผ่าน backend ที่ชื่อ ourhoomu-api และ frontend ชื่อ ourhoomu-front

## Decision ที่เสนอ

- TypeScript สำหรับ frontend และ Edge Functions; PostgreSQL SQL สำหรับ schema/invariants
- Expo / React Native / Expo Router สำหรับ iOS; development build และ EAS Build/TestFlight
- Supabase Free สำหรับ Postgres, Auth, private Storage และ Edge Functions
- API เป็น backend ที่ควบคุม auth exchange, reads/writes, third-party slip integration และ retention
- Critical writes อยู่ใน PostgreSQL transaction/RPC; Edge Functions ไม่ประกอบหลาย HTTP writes แล้วถือว่าเป็น transaction
- pnpm workspace สำหรับ npm tooling เมื่อเริ่ม scaffold; Deno config แยกใน backend, ไม่มี Turborepo/Nx จนกว่าจะมีเหตุผล

## Alternatives

| ทางเลือก | เหตุผลที่ยังไม่เลือก |
|---|---|
| SwiftUI + backend | เหมาะกับ native iOS แต่ใช้ Swift และอีกภาษาใน backend; Expo ลดจำนวนชุด tooling สำหรับ MVP นี้ |
| Flutter + Supabase | ใช้ได้ แต่เพิ่ม Dart ขณะที่ TypeScript ใช้ได้ทั้งสองฝั่ง |
| Expo + custom Node server + managed DB | เพิ่มการ deploy/monitor อีก service ทั้งที่ Supabase มี Functions อยู่แล้ว |
| Firebase | ใช้ได้ แต่แบบข้อมูลของงานนี้เหมาะกับ relational constraints และ transaction ใน PostgreSQL มากกว่า; เป็น judgment ของ Tech Lead |
| PWA | แจกง่าย แต่ผู้ใช้เลือก iOS/TestFlight แล้ว |

## Consequences

เริ่มจาก managed backend เดียว SQL migrations เคลื่อนย้ายไป PostgreSQL อื่นได้ แต่ Auth/Storage/Functions ยังมี coupling จึงแยก adapters ไม่ทำ portability framework ล่วงหน้า

Free tier มีโควตา การ pause และไม่มี automatic backups; API สลิปกับ Apple Developer เป็นต้นทุนแยก เก็บการตัดสินใจอัปเกรดตาม usage/availability ไม่ใช่จำนวนผู้ใช้เพียงอย่างเดียว ดู [operations](../project/operations.md)

แหล่งทางการ: [Expo](https://docs.expo.dev/faq/), [Supabase pricing](https://supabase.com/pricing), [Database RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [TestFlight](https://developer.apple.com/testflight/)
