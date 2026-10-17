# Decision log และรายการรอยืนยัน

วันที่ 2026-10-12 · Design v0.1

## ยืนยันแล้วจากผู้ใช้

- 2026-10-17: ผู้ใช้ยืนยัน “ถ้า schedule เวรหมดอายุให้แสดงเวรที่ไม่ได้ทำ” — เมื่อ schedule หมดอายุ ต้องยังแสดง occurrence ที่ยังไม่ได้ทำตามสิทธิ์สมาชิกและระยะเก็บประวัติที่ยืนยันแล้ว การหมดอายุของ schedule เพียงอย่างเดียวต้องไม่ทำให้เวรเหล่านี้หายจากรายการ งาน SW-0063 ต้องแยกความหมายการหมดอายุของ schedule ออกจากการหมดอายุข้อมูลก่อนตรึง `ChoreSchedule.expiresAt`; คำตอบนี้ยังไม่ได้กำหนดวิธีคำนวณวันหมดอายุของ schedule

- รอบนี้เอกสารและ checklist ก่อนพัฒนา
- TestFlight เป็นช่องทางแจกช่วงแรก
- Google + Apple login ผ่าน ourhoomu-api; THB; ไทยหรืออังกฤษได้
- ทุกคนสร้างบิลและเปลี่ยนผู้รับเงินได้ ผู้รับเงินออกเงินก่อนและหักส่วนตนเองอัตโนมัติ
- รองรับทยอยจ่าย โอนตรวจ API ภายนอก เงินสดผู้สร้างบิลยืนยัน
- สลิปเฉพาะผู้แนบและผู้รับเงิน
- เวรจัดเอง/ทำซ้ำ/หมุนอัตโนมัติ ผู้รับกดเสร็จ
- แจ้งเตือนทั่วไปในแอปเมื่อเปิด ไม่มี APNs/Expo Push/local notifications ในแอพ iOS; ผู้ใช้เพิ่ม LINE OA push เมื่อยืนยันการจ่ายเงิน และจะให้ credentials ภายหลัง — [design](line-oa.md)
- ประวัติทุกอย่างไม่เกินหนึ่งปีนับจากสร้าง
- เปรียบเทียบ provider แล้ว; ผู้ใช้เลือก SlipOK ตามคำสั่ง “ใช้ slipOk แทน” เมื่อ 2026-10-12 ยังไม่ได้ซื้อหรือเชื่อม API จริง
- เลือก Neon database; อนุญาต CLI/skills/MCP/link โปรเจกต์ lucky-bar-14515304 branch production, config private slip bucket และ neon deploy ตาม SW-0015
- ขอออกแบบ database ตาม requirement ล่าสุด — [database design](database.md), SW-0019; ยังไม่ได้อนุมัติ schema migration/full implementation

- 2026-10-12: ยืนยัน PostgreSQL บน Neon + Drizzle ORM สำหรับ schema/query, Elysia API บน Cloudflare Workers Free และ React Native + Expo; คำสั่งล่าสุด “ใช้ bun react native expo” แทนคำสั่งก่อนหน้าที่ไม่ใช้ Bun ฝั่ง frontend ใช้ Bun stable ล่าสุดที่เข้ากันสำหรับ dependencies/scripts ทั้งสองฝั่ง และ pin exact versions ตอน SW-0003; Workers runtime/Hermes เป็น runtime ปลายทาง ดู [SW-0020](../team/tickets/SW-0020.md) ยังไม่อนุมัติ full design/application implementation หรือ Cloudflare deploy
- 2026-10-12: Tech Lead จัด [MVP spec](spec.md) และ investigation tickets SW-0022–0024 เพื่อปิดความเสี่ยงของ stack/identity/retention; งานเอกสาร SW-0021 ไม่ถือว่าผู้ใช้ยืนยัน D2–D12 หรือ feasibility แล้ว ดู [ADR-0003](../adr/0003-selected-stack.md)

- 2026-10-12: ผู้ใช้อนุญาต “เริ่มทำฝั่ง front ได้เลย” พร้อม animation/theme น่ารักและ “ไม่ต้องสนใจ figma”; อนุมัติ frontend scaffold/demo UI ตาม SW-0026–0028. SW-0025 ยกเลิกการเป็น dependency ของ frontend; partial Figma artifact เก็บเป็นประวัติ ไม่ถือว่า design ครบ. Domain/backend/release decisions เดิมยัง pending.
- 2026-10-13: Lead รับ frontend local demo หลัง independent review และ integrated checks ที่ source `97eaa6e`; SW-0029–0031 แก้ copy/motion/touch targets/empty-status rendering ในขอบเขตเดิม. SW-0009/10/11 เปลี่ยน dependency จาก Figma ที่ยกเลิกเป็น frontend contract/artifact ที่รับแล้ว โดยคง real API/native acceptance pending — [หลักฐาน](../team/reports/SW-0027-integration.md).

## ข้อเสนอของ Tech Lead สำหรับตรวจแบบ

| ID | ข้อเสนอและเหตุผล |
|---|---|
| D1 | Neon PostgreSQL/private slip bucket ตาม ADR-0002; Drizzle ORM, Elysia, Cloudflare Workers Free, React Native/Expo และ Bun tooling ยืนยันตาม SW-0020; identity/session integration และ database driver/actor context ยังต้องตรึง |
| D2 | UI ไทย, timezone บ้านเริ่ม Asia/Bangkok; เก็บเวลาระบบเป็น UTC และวันเวรเป็นวันที่ท้องถิ่น |
| D3 | owner บ้านจัดการชื่อ/สมาชิก/คำเชิญ; สมาชิกทุกคนสร้างบิลและตารางเวรได้ ผู้สร้างจัดการรายการของตน; owner จัดการเวรได้ แต่ไม่มีสิทธิ์ดูสลิปเพิ่ม |
| D4 | เชิญผ่านลิงก์หรือรหัสแบบใช้ครั้งเดียว อายุ 7 วัน แชร์เองได้ ไม่ส่งอีเมลจากระบบ; owner ยกเลิกได้ |
| D5 | ทำซ้ำรายวันหรือรายสัปดาห์/เลือกวัน; หมุนหนึ่งคนต่อ occurrence ตามลำดับสมาชิกที่กำหนด แสดง preview ก่อนบันทึก |
| D6 | เงินใช้ integer สตางค์ เปอร์เซ็นต์ใช้ basis points; largest remainder ให้ยอดรวมตรง ดู domain |
| D7 | อายุประวัติใช้ 365 วันจาก created_at เป็นขีดสูงสุด เริ่มปิดการเข้าถึงและลบก่อน deadline 24 ชั่วโมงเพื่อเผื่อ retry; child ต้องไม่อยู่เกิน parent; ข้อมูลบัญชี/บ้านที่ยังใช้งานเป็น current state ไม่ใช่ประวัติหมดอายุ |
| D8 | บิลเผยแพร่แล้วตรึงยอด/ผู้หาร/ผู้รับ/บัญชีรับเงิน; ยกเลิกได้ก่อนมีเงินยืนยันเท่านั้น ไม่แก้ยอดย้อนหลัง |
| D9 | สลิปหนึ่งธุรกรรมต่อหนึ่งงวด ไม่แบ่งสลิปเดียวคร่อมหลายบิล; เงินโอนที่ตรวจไม่ได้คง pending/needs_attention ไม่มี manual approve แทน |
| D10 | all domain reads/writes และ slip downloads ผ่าน API; native login consent และ signed file upload เป็นขั้นตอนนอก API ที่จำเป็น; download ตรวจ membership สดทุก request |
| D11 | ไม่เพิ่มหน้าจอ manual account linking ใน MVP เป็นข้อเสนอ; identity/session provider และ linking policy ต้องกำหนดใหม่สำหรับ Neon ไม่อ้าง Supabase auto-linking เดิมเป็นพฤติกรรมที่ใช้อยู่ และไม่รวมบัญชีจาก display name |
| D12 | เมื่อเปิด/กลับเข้า foreground/กด refresh ดึงข้อมูลล่าสุด; offline อ่าน cache ที่ไม่หมดอายุได้ แต่การจ่าย/ยืนยัน/ทำเวรต้องออนไลน์ |

## การตัดสินใจที่ยังค้าง

| เรื่อง | Owner / next action | ขวางอะไร |
|---|---|---|
| อนุมัติ design v0.1 รวม D1–D12 หรือระบุข้อแก้ | ผู้ใช้ผ่าน Tech Lead หลังอ่านเอกสาร | API/production implementation; frontend demo ได้รับอนุญาตตาม SW-0027 แล้ว |
| Database operational policies | Tech Lead เสนอ replay floor เพื่อกันสลิปซ้ำหลัง purge/restore, nullable provenance สำหรับลบอดีตสมาชิก และ TTL/เงินเพดาน/clock tolerance ตาม [database design](database.md); ผู้ใช้ตรวจผลต่อ late-transfer UX ก่อนตรึง schema | SW-0004 และ credit/recovery ที่เกี่ยวข้อง ไม่ใช่การยืนยันว่า deploy แล้ว |
| LINE OA ผู้รับ/การผูกบัญชีหรือกลุ่ม/ข้อความ และ retention สำเนาใน LINE | Tech Lead รอคำตอบผู้ใช้เรื่องปลายทางก่อนตรึง flow; credentials ให้ภายหลัง; scope เงินโอน/เงินสดทุกงวดเป็นข้อเสนอ | SW-0018 และการส่งข้อมูลจริง; ไม่ขัดขวางเอกสารส่วนที่ยืนยันแล้ว |
| SlipOK credentials/แพ็กเกจและงบ | เลือก SlipOK แล้ว; ผู้ใช้เตรียม key/branch ID ใน secret store และยืนยันงบก่อนซื้อ; Tech Lead ตรวจ multi-recipient matching | ต่อ API จริง/ซื้อแพ็กเกจ ไม่ขวางการส่งเอกสาร |
| ผู้ให้บริการเก็บข้อมูล/ลบก่อนครบ 365 วันได้จริงหรือไม่ | Tech Lead/platform ตรวจข้อกำหนดและหลักฐานจาก provider ที่เลือก โดยไม่ส่งข้อความภายนอกจนได้รับคำสั่ง | เปิดใช้สลิปจริง; ไม่อ้างว่าสอดคล้อง retention แล้ว |
| หากผู้สร้างบิลยืนยันเงินสดของตนเอง เมื่อผู้รับเงินเป็นคนอื่น | ข้อเสนอ: อนุญาตตามกติกาผู้สร้างยืนยันของผู้ใช้ พร้อม audit และผู้รับเห็นสถานะ; ผู้ใช้แก้ได้ในการ review | ต้องยืนยันก่อนพัฒนา flow เงินสด |
| Google-Apple session integration บน Elysia/Cloudflare Workers หลังเลือก Neon | Tech Lead ตรวจ Neon Auth ที่เปิดอยู่แล้ว เสนอ contract/ต้นทุนก่อนพัฒนา; setup นี้ยังไม่มี native login/API integration proof | SW-0003–SW-0005 และการเชื่อม API จริง |
| มี Apple Developer / Expo / Google OAuth credentials พร้อมหรือยัง | ผู้ใช้จัดเตรียมใน secret store ตอน release; Neon CLI login/setup สำเร็จแล้ว ไม่ใส่ keys ในเอกสาร | ทดสอบ social login จริงและ TestFlight |

ผู้ใช้ยืนยันแบบหลังอ่านแล้ว ให้ Tech Lead ลงวัน/ข้อความยืนยันและ revision ที่อนุมัติที่นี่ ปรับ requirement/criteria ที่ได้รับผล ก่อนเปลี่ยน ticket จาก draft เป็น ready

## Backend planning checkpoint — 2026-10-13

User asked for backend task planning, frontend coordination and multiple agents; SW-0033 planning/source research and independent final review accepted on local. [Backend plan](../team/backend-plan.md) is concrete proposal for user review; D2–D12, cash self-confirm, auth/operational/external-copy choices remain unconfirmed. SW-0004 proposed core scope and SW-0037 provider/retention extensions preserve original full privacy/data criteria. SW-0003 API foundation native startup proof transferred to SW-0009-AC5, still pending; reviewer approved handoff. No implementation/migration/production/provider authorization inferred from planning success.

## Confirmed core plan — 2026-10-13

User “ยืนยันแผน” confirms [backend plan v0.2](../team/backend-plan.md) for core local/dev and retained provider/native/release gates. D2–D6,D8–D10,D12, D7 technical365d/deadline/access24h-earlier/child caps and creator-as-payer cash audit rule accepted for development. [Core scope/values](../team/core-implementation.md). Identity remains one session/actor interface with gated Managed/native compatibility proof; LINE destination/external copies/credentials and real provider/native/production acceptance remain unresolved where specified.
