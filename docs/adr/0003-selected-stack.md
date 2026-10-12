# ADR-0003: Elysia, Cloudflare Workers Free, Drizzle และ Bun tooling

Date: 2026-10-12
Status: Accepted สำหรับ stack selection เท่านั้น; implementation/release ยังรอ design gates
Supersedes: [ADR-0001](0001-stack.md) ส่วน frontend/tooling/API hosting; [ADR-0002](0002-neon.md) ยังเป็นแหล่งจริงสำหรับ Neon setup

## Context

ผู้ใช้เลือก PostgreSQL + Drizzle ORM สำหรับ schema/query, Elysia API, Cloudflare Workers Free เพื่อเริ่มโดยไม่คิดค่า API hosting เมื่อเกินโควตา และ React Native + Expo โดยใช้ Bun tooling ทั้ง frontend/backend คำสั่งล่าสุดเรื่อง Bun frontend แทนคำสั่งก่อนหน้าที่ไม่ใช้ Bun frontend

## Decision

- API ใช้ Elysia บน Cloudflare Workers Free; Bun ใช้ install/run scripts ระหว่างพัฒนา ส่วน production runtime คือ Workers
- iOS ใช้ React Native + Expo; Bun เป็น package manager/script runner; Node.js LTS ยังจำเป็นสำหรับคำสั่ง Expo บางอย่าง; mobile JavaScript ใช้ Hermes
- Neon PostgreSQL ใช้ Drizzle ORM สำหรับ schema/query และ Drizzle Kit สำหรับ migrations SQL ที่จำเป็นต่อ constraints/RLS/grants/atomic routines ต้อง review แยก ไม่ให้ ORM แทน database security
- เริ่มจาก Workers Free แบบ fail closed; ไม่เปิด Paid/บริการที่คิดเงินแยกโดยไม่มี authorization

## Consequences และ gates

Elysia Cloudflare adapter ถูกระบุว่า experimental จึงต้องพิสูจน์ runtime/plugin compatibility ก่อนงาน API [SW-0022](../team/tickets/SW-0022.md) Drizzle Neon HTTP และ WebSocket มี transaction capabilities ต่างกัน ต้องออกแบบ critical writes ให้ atomic บน Workers จริงก่อน implementation [SW-0004](../team/tickets/SW-0004.md) ความเป็นไปได้ของ Cron/retention บน Free plan ต้องตรวจแยก [SW-0023](../team/tickets/SW-0023.md) Identity/session integration กับ Neon Auth/Google/Apple ยังต้องตรึง [SW-0024](../team/tickets/SW-0024.md)

การตัดสินใจ stack ไม่อนุมัติ Cloudflare deploy, app scaffold, product migrations หรือการซื้อบริการ [MVP spec](../project/spec.md) และ [decision log](../project/decisions.md) แยกสิ่งที่ยืนยันแล้วจากเรื่องที่รอผู้ใช้

## Sources checked

[Elysia Workers adapter](https://elysiajs.com/integrations/cloudflare-worker), [Drizzle Neon drivers](https://orm.drizzle.team/docs/connect-neon), [Expo Bun guide](https://docs.expo.dev/guides/using-bun/), [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
