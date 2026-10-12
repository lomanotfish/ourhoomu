# OurHoomu MVP specification — review draft

วันที่ 2026-10-12 · ขอบเขต: iOS MVP และ API ที่รองรับ · สถานะ: รอตรวจข้อเสนอผลิตภัณฑ์ที่ระบุด้านล่าง

เอกสารนี้เป็นจุดเข้าอ่าน spec ไม่แทนรายละเอียดที่มีอยู่แล้วใน [requirements](../team/requirements.md), [domain](domain.md), [UX](ux.md), [API](api-contract.md), [database](database.md), [LINE OA](line-oa.md) และ [operations](operations.md) หากข้อความขัดกัน ให้ใช้ requirement ที่ผู้ใช้ยืนยันล่าสุดก่อน แล้วให้ Tech Lead แก้ contract ที่ขัดกันก่อนเริ่ม implementation

## เป้าหมายและผู้ใช้

คนอยู่บ้านร่วมกันไม่เกิน 10 คนในช่วงแรกใช้ iPhone เพื่อเห็นว่าใครต้องจ่ายใคร ยอดค้างที่ตรวจแล้ว เวรที่ต้องทำ และกิจกรรมที่เปลี่ยนไป โดยหนึ่งบัญชีอยู่ได้หลายบ้าน ผู้ใช้ทดลองผ่าน TestFlight หลัง QA และ authorization สำหรับเผยแพร่

## Capability map และลำดับงาน

| Capability | ผลลัพธ์ที่ผู้ใช้เห็น | Contract หลัก | Ticket |
|---|---|---|---|
| foundation | แอปกับ API รันใน environment ทดสอบ | [architecture](architecture.md), [operations](operations.md) | [SW-0003](../team/tickets/SW-0003.md) |
| identity-house | Google/Apple session, บ้านและสมาชิกหลายบ้าน | [API](api-contract.md), [domain](domain.md) | [SW-0004](../team/tickets/SW-0004.md), [SW-0005](../team/tickets/SW-0005.md), [SW-0009](../team/tickets/SW-0009.md) |
| bill-payment | บิล, หารตาม %, ผู้รับเงิน, ทยอยจ่ายเงินสด/โอน | [domain](domain.md), [database](database.md), [API](api-contract.md) | [SW-0006](../team/tickets/SW-0006.md), [SW-0007](../team/tickets/SW-0007.md), [SW-0010](../team/tickets/SW-0010.md) |
| chores-activity | เวรสามโหมด, เสร็จแล้ว, in-app feed | [domain](domain.md), [UX](ux.md) | [SW-0008](../team/tickets/SW-0008.md), [SW-0011](../team/tickets/SW-0011.md) |
| line-payment | LINE OA เมื่อยอดงวด confirmed | [LINE OA](line-oa.md) | [SW-0018](../team/tickets/SW-0018.md) |
| retention-release | ลบประวัติภายในหนึ่งปี, QA, TestFlight | [operations](operations.md), [domain](domain.md) | [SW-0013](../team/tickets/SW-0013.md), [SW-0012](../team/tickets/SW-0012.md), [SW-0014](../team/tickets/SW-0014.md) |

ทิศทาง dependency: foundation → identity-house → bill-payment และ chores-activity; bill-payment → line-payment; ทุก capability ที่เก็บประวัติ → retention-release การเชื่อม LINE กับบิลใช้ event/outbox หลัง commit ไม่เปลี่ยนยอดเมื่อส่งข้อความล้มเหลว

## พฤติกรรมที่ต้องตรวจรับ

| Flow | เกณฑ์สังเกตได้ | Requirement / acceptance |
|---|---|---|
| Login และบ้าน | Google/Apple ผ่าน API บน development build; 0/1/หลายบ้าน; invite หมดอายุ/ใช้ซ้ำ/ข้ามบ้านไม่ได้ | R3–R4; AC1a, AC2 |
| บิลและการหาร | สมาชิกทุกคนสร้างบิล เลือกผู้รับเงิน ผลรวม 100%; 200 บาทหาร A/B เท่ากันแล้ว A self-covered 100, B ค้าง 100 | R5–R7; AC3 |
| งวดการจ่าย | B จ่าย 40 แล้ว 60; pending ไม่ลดค้าง; โอนต้องตรวจ SlipOK, เงินสดผู้สร้างยืนยัน; retry/duplicate ไม่เพิ่มเครดิตซ้ำ | R8, R14; AC4 |
| ความเป็นส่วนตัวสลิป | ผู้แนบและผู้รับเงินเท่านั้นดูได้พร้อม membership สด; owner/creator ไม่ได้สิทธิ์เพิ่ม | R9; AC5 |
| เวรและกิจกรรม | จัดเอง/ทำซ้ำ/หมุนอัตโนมัติ; assignee กดเสร็จ; feed สดเมื่อเปิด/refresh; ไม่ขอ iOS notification permission | R10–R11; AC6 |
| LINE | confirmed installment ส่งตาม binding/ผู้รับที่ยืนยัน; failure ไม่ย้อนยอด; webhook และ retry ปลอดภัย | R16; AC10 |
| อายุข้อมูล | ประวัติทุกประเภทพร้อมไฟล์/child/cache/logs/สำเนาที่ควบคุมได้เข้าถึงไม่ได้และถูกลบก่อนครบหนึ่งปีจาก created_at | R12; AC7 |
| Pilot | QA บน integrated artifact ก่อน; TestFlight install/smoke บน iPhone จริงหลังอนุญาตส่ง | R1; AC1b |
| เอกสารและ stack | Requirements/decision gates ตรวจย้อนถึง tickets; Neon setup/private bucket มีหลักฐาน; stack ปัจจุบันตรงกับคำสั่งล่าสุด | R13–R15, R17; AC8, AC9, SW-0020/0021 |

คำว่า “ผ่าน” สำหรับ AC1a–AC7/AC10 ต้องมี integrated runtime evidence ตาม [requirements](../team/requirements.md) เอกสารและ mock เป็นหลักฐานออกแบบ/พัฒนาเฉพาะส่วนเท่านั้น

## Stack และขอบเขตระบบ

- iOS: React Native + Expo, TypeScript; Bun stable ล่าสุดที่เข้ากันสำหรับ dependencies/scripts และ EAS lockfile; Node.js LTS ยังจำเป็นสำหรับ Expo prerequisites; JavaScript บนอุปกรณ์รันด้วย Hermes
- API: Elysia + TypeScript บน Cloudflare Workers Free; Bun ใช้พัฒนาและรัน scripts ฝั่ง backend ขณะ production ใช้ Workers runtime Cloudflare adapter ของ Elysia ยังเป็น experimental จึงต้องพิสูจน์ใน local Workers runtime ก่อนพัฒนาฟีเจอร์
- Data: Neon PostgreSQL, Drizzle ORM สำหรับ schema/query, Drizzle Kit migrations และ reviewed SQL สำหรับ constraints, RLS, grants, routines ที่ ORM ไม่แทนได้ Neon production ที่ link อยู่ไม่ใช่ sandbox สำหรับ product migrations
- Files: Neon private slip bucket; upload จำกัดผ่าน server-issued URL, download ผ่าน API ที่ตรวจ session และสิทธิ์สดทุกคำขอ
- External: SlipOK ตรวจสลิปและ LINE Messaging API ตาม policy ที่ยืนยันภายหลัง Credentials อยู่ใน server secrets เท่านั้น

Drizzle Neon HTTP เหมาะกับคำสั่งเดี่ยวหรือ transaction ที่ไม่ interactive ส่วน flow ที่ต้องล็อก row และตรวจหลายขั้นตอนใน transaction ต้องพิสูจน์ WebSocket driver หรือ SQL routine ที่ atomic จริงบน Workers ก่อนเลือก driver ห้ามแยก critical write เป็นหลาย HTTP queries ที่ไม่ atomic ดู [Drizzle Neon](https://orm.drizzle.team/docs/connect-neon)

Cloudflare Workers Free มี request/CPU/Cron limits; เกินโควตา API ควร fail closed ไม่ข้ามการตรวจสิทธิ์ไป origin ค่าใช้จ่าย Neon, SlipOK, LINE, EAS/Apple เป็นคนละส่วน ดู [operations](operations.md)

## สภาพแวดล้อม คำสั่ง และ code style

ปัจจุบันมีเพียง root Neon tooling: `npm ci` ติดตั้ง dependencies สำหรับ `neon.ts` ยังไม่มีแอปและยังไม่มีคำสั่ง build/test ที่รันได้ SW-0003 ต้องตรึงเวอร์ชัน Bun/Node/Expo/Elysia/Drizzle/Wrangler ที่เข้ากัน แล้วบันทึกคำสั่ง install/dev/typecheck/test/build ที่ลองจริงแยกใน README ของ front/back รวม EAS lockfile behavior ใช้ Bun lockfile สำหรับ app packages โดยไม่ทำลาย root Neon npm lockfile โดยพลการ

โครงสร้างปลายทาง: `ourhoomu-front/` เป็น iOS app, `ourhoomu-api/` เป็น API/schema/migrations/tests, `docs/project/` เป็น design contracts และ `docs/team/tickets/` เป็น backlog Source/test naming, formatter และ lint configuration ตรึงกับ SW-0003 เมื่อมี source files แรก; เวลาระบบ UTC, วันเวรตาม timezone บ้าน, เงินเป็น integer satang และเปอร์เซ็นต์เป็น basis points ตาม [domain](domain.md)

## แผนพิสูจน์และขอบเขตการทำงาน

- SW-0022 พิสูจน์ adapter/driver/transaction contract จากเอกสารทางการก่อน SW-0003/0004; SW-0003 ทำ local Workers/Expo smoke และ pin versions จริง
- SW-0024 ตรึง Google/Apple session/Neon Auth mapping, refresh/revoke และ actor context ก่อน SW-0005; native login จริงยังต้องทดสอบบนเครื่อง
- Unit/property tests ตรวจ %/ปัดเศษ/state; Postgres integration/race/RLS tests ตรวจ cross-house, double finalize และ retention; API contract tests ตรวจ DTO/error/permissions; iPhone tests ตรวจ login/flow/accessibility; QA ตรวจ provider/LINE จริงแยกจาก fixtures
- SW-0023 ตรวจ Cloudflare Free scheduler/CPU/quota กับ purge/outbox/backup/provider retention ก่อนอ้างว่างานลบใน SW-0013 ทำได้ภายใน deadline
- ยืนยัน secrets และ production branch ก่อน external deploy/data writes; การสร้าง ticket หรือ spec ไม่ได้อนุญาตให้ scaffold, migrate, ซื้อบริการ, ส่งข้อมูลจริง, หรือเผยแพร่ build

## ข้อเสนอที่รอคำตัดสิน

รายการที่ยังรอผู้ใช้/หลักฐานจริงอยู่ใน [decisions](decisions.md): D2–D12, replay-floor/late-transfer policy, creator-as-payer cash, ผู้รับและ binding LINE/ข้อความ/สำเนา, SlipOK recipient matching/retention/งบ, identity/session linking และหลักฐานการลบสำเนา/backup การเลือก stack R17 ยืนยันแล้ว แต่ไม่ได้ยืนยันข้อเสนอเหล่านี้

ก่อนเปลี่ยน implementation ticket เป็น `ready` ต้องมีคำยืนยัน design revision, accepted prerequisite contracts, owner/allowed edits/worktree, required checks และ test environment ที่ไม่ใช้ production product data

นอก MVP ตาม [requirements](../team/requirements.md): รับเงินผ่านแอป, wallet/payment gateway, chat, multi-currency, iOS system notifications และ offline financial writes การตัด feature ที่ยืนยันแล้วต้องเป็นคำตัดสินผู้ใช้และอัปเดต requirement/tickets ก่อน
