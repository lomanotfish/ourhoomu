# Requirement brief — OurHoomu

วันที่: 2026-10-12 · Design: v0.1 · สถานะ: เก็บคำตอบหลักแล้ว / รอตรวจเอกสารฉบับเต็ม

## เป้าหมายและขอบเขตรอบนี้

แอพ iOS สำหรับคนอยู่บ้านร่วมกัน เริ่มต้นไม่เกิน 10 ผู้ใช้ รองรับหลายบ้านในบัญชีเดียว ลดการตามเงินและความสับสนว่าใครมีเวรอะไร

ขอบเขตเดิมคือออกแบบและเอกสารก่อนพัฒนา ต่อมาผู้ใช้อนุญาต Neon setup โดยเฉพาะ: ติดตั้ง CLI/skills/MCP, link production, ติดตั้ง config dependencies, เขียน neon.ts และ neon deploy ตาม SW-0015 ยังไม่อนุญาต application implementation, domain migrations หรือเผยแพร่ iOS build

คำสั่งล่าสุด “ออกแบบ database ตาม requirement” อนุญาต database design ตาม [SW-0019](tickets/SW-0019.md) ครอบคลุม SlipOK และ LINE OA ที่เพิ่มแล้ว ไม่ใช่การอนุมัติรัน migration บน production หรืออนุมัติ pending product decisions

คำสั่งเลือก stack ล่าสุดยืนยัน PostgreSQL + Drizzle ORM สำหรับ schema/query, Elysia API บน Cloudflare Workers Free และ React Native + Expo โดยใช้ Bun tooling ทั้ง front/back ตาม [SW-0020](tickets/SW-0020.md) ไม่ใช่การอนุมัติ scaffold/migration/deploy แอป

Tech Lead ตีความคำขอล่าสุดให้ตรวจ backlog และทำ spec ครอบคลุม MVP ทั้งแอปเป็นเอกสาร [MVP spec](../project/spec.md) ตาม [SW-0021](tickets/SW-0021.md); ข้อเสนอใน spec ยังรอผู้ใช้ตรวจและไม่ทำให้ application tickets พร้อมพัฒนาโดยอัตโนมัติ

## ข้อกำหนดที่ผู้ใช้ยืนยัน

| ID | พฤติกรรมที่ต้องได้ |
|---|---|
| R1 | iOS app; ช่วงแรกแจกด้วย TestFlight |
| R2 | Monorepo มี ourhoomu-api และ ourhoomu-front; hosting เริ่มง่ายและฟรีภายในโควตา ขยายต่อได้ |
| R3 | สมัคร/เข้าสู่ระบบด้วย Google และ Apple ผ่าน ourhoomu-api; ภาษาไทยหรืออังกฤษได้ สกุลเงิน THB |
| R4 | สร้างบ้าน เชิญสมาชิก ผู้ใช้อยู่หลายบ้านได้; หากมีบ้านเดียวเข้าไปทันที |
| R5 | ทุกสมาชิกสร้างบิลได้ ผู้รับเงิน default เป็นผู้สร้าง แต่เลือกสมาชิกคนอื่นได้ |
| R6 | เลือกผู้หารและเปอร์เซ็นต์แต่ละคน ผลรวมต้องเท่ากับ 100%; แสดงจำนวนเงินที่แต่ละคนรับผิดชอบ |
| R7 | ผู้รับเงินคือผู้ที่ออกค่าใช้จ่ายไปก่อน ส่วนที่ผู้รับเงินต้องรับผิดชอบถูกหักให้อัตโนมัติ |
| R8 | สมาชิกอื่นทยอยจ่ายได้ หลายงวด; โอนเงินแนบสลิปและตรวจด้วย API ภายนอก; เงินสดให้ผู้สร้างบิลยืนยัน |
| R9 | ไฟล์สลิปดูได้เฉพาะผู้แนบสลิปและผู้รับเงิน ผู้สร้างบิลหรือ owner บ้านไม่ได้สิทธิ์เพิ่มโดยอัตโนมัติ |
| R10 | เวรมีสามโหมด: จัดเอง ทำซ้ำ และหมุนอัตโนมัติ; ผู้รับเวรกดทำเสร็จ |
| R11 | แจ้งสิ่งที่ต้องทำและความเปลี่ยนแปลงในแอปเมื่อเปิด; ไม่ใช้ APNs/Expo Push หรือ local notifications ในแอพ iOS; เพิ่ม LINE OA ตาม R16 |
| R12 | ประวัติทุกประเภท รวมสลิป บิล การจ่าย เวร และกิจกรรม เก็บไม่เกินหนึ่งปีนับจากวันสร้าง |
| R13 | Agent ถาม requirement ให้แน่ใจ สรุป และรอผู้ใช้ยืนยันก่อนเริ่มงาน; สถานะจริงและ checklist ดูแลโดย Tech Lead |
| R14 | เปรียบเทียบ API ตรวจสลิปแล้ว ผู้ใช้เลือก SlipOK เมื่อ 2026-10-12 ยังไม่อนุมัติซื้อ; ต้องผ่าน recipient/retention gate ก่อนส่งสลิปจริง |
| R15 | ใช้ Neon database โปรเจกต์ lucky-bar-14515304 branch production ใน working directory; ติดตั้ง CLI/skills/MCP และ deploy config preview.buckets.slip access=private |
| R16 | ส่ง LINE OA push message เมื่อยืนยันการจ่ายเงิน ผู้ใช้ให้ Channel ID/secret/access token (long-lived) ภายหลัง; ผู้รับข้อความและ binding flow รอยืนยันตาม [LINE OA design](../project/line-oa.md) |
| R17 | PostgreSQL บน Neon; Drizzle ORM นิยาม schema และ query; Elysia API บน Cloudflare Workers Free; frontend React Native + Expo; Bun stable ล่าสุดที่ตรวจความเข้ากันได้สำหรับ dependencies/scripts ทั้ง front/back โดย production API ใช้ Workers runtime และ iOS ใช้ Hermes |

ตัวอย่าง R6–R8 ที่ผู้ใช้ยืนยัน: ค่าใช้จ่าย 200 บาท หารสองคน 50%/50% โดย A เป็นผู้รับเงิน/คนออกเงิน A รับผิดชอบ 100 บาทอัตโนมัติ B ต้องจ่ายคืน 100 บาท B จ่าย 40 แล้ว 60 ได้

## Observable acceptance ของแอพในอนาคต

| Criterion | สิ่งที่ต้องพิสูจน์ | Ticket | สถานะตอนนี้ |
|---|---|---|---|
| AC1a (R2–R3) | Google/Apple จริงเข้าสู่ session ผ่าน API บน development build/iPhone ก่อน release | SW-0003, SW-0005, SW-0009, SW-0012 | pending |
| AC1b (R1) | หลัง pre-release QA ผ่าน ติดตั้ง beta บน iPhone ผ่าน TestFlight จริงและ smoke login/API | SW-0014 | pending |
| AC2 (R4) | 0 บ้านเห็นสร้าง/เข้าร่วม, 1 บ้าน redirect, 2 บ้านเลือกได้; invite หมดอายุ/ใช้ซ้ำ/บ้านอื่นเข้าถึงไม่ได้ | SW-0004, SW-0005, SW-0009 | pending |
| AC3 (R5–R7) | เปลี่ยนผู้รับเงินได้, 99.99%/100.01% ถูกปฏิเสธ, เศษสตางค์รวมตรงยอดบิล, ตัวอย่าง 200 บาทผ่าน | SW-0004, SW-0006, SW-0010 | pending |
| AC4 (R8) | 40+60 ปิดยอด 100; pending ไม่เป็น paid; duplicate/ผิดบัญชี/timeout/การส่งซ้ำไม่เพิ่มเครดิตผิด; เงินสดยืนยันโดยผู้สร้าง | SW-0006, SW-0007, SW-0010 | pending |
| AC5 (R9) | ผู้แนบ/ผู้รับดูภาพได้ คนอื่นรวม owner และผู้สร้างบิลที่ไม่ใช่สองคนนี้ถูกปฏิเสธ; คำขอดาวน์โหลดใหม่หลังออกจากบ้านถูกปฏิเสธ ไม่มี direct read URL | SW-0004, SW-0007, SW-0012 | pending |
| AC6 (R10–R11) | สร้างเวรครบสามโหมด; หมุนไม่สร้างซ้ำ; ผู้รับกดเสร็จแล้วกิจกรรมปรากฏเมื่อสมาชิกเปิดแอป; ไม่มีขอสิทธิ์ notifications | SW-0008, SW-0011 | pending |
| AC7 (R12) | เมื่อถึง expiry เข้าถึงรายการ/ไฟล์ไม่ได้; purge ไม่ทิ้ง child/orphan หรือคืนข้อมูลหมดอายุจาก backup | SW-0004, SW-0007, SW-0013, SW-0012 | pending |
| AC8 (R13–R14) | มีเอกสาร/สองโฟลเดอร์/checklist/ตารางเปรียบเทียบพร้อมแหล่งข้อมูล; มี gate ก่อน implementation | SW-0002 | done เฉพาะ docs — ดู review/resolution และ integrated checks ใน ticket |
| AC9 (R15) | CLI login/link ถูก project/branch, skills/MCP ติดตั้ง, neon.ts ตามผู้ใช้, deploy exit 0 และตรวจ slip bucket private จาก remote จริง; secrets ไม่เข้า Git | SW-0015 | done เฉพาะ Neon setup — ดูหลักฐานใน ticket |
| AC10 (R16) | การยืนยันเงิน enqueue แจ้ง LINE หลัง commit ตามผู้รับที่ยืนยัน; retries ไม่เครดิต/แจ้งซ้ำผิด; webhook/binding ปลอดภัย; LINE failure ไม่ย้อนยอด; ทดสอบส่งจริงเมื่อพร้อม | SW-0018 | pending ผู้รับ/credentials/design approval |

แอพยังไม่ผ่าน runtime acceptance AC1a–AC7 การผ่านเอกสาร AC8 ไม่ได้ทำให้ feature ของแอพเสร็จ

## ข้อเสนอที่ยังไม่ใช่คำยืนยันผู้ใช้

Stack ยืนยันตาม R17 แล้ว ส่วนภาษา UI ไทย, timezone Asia/Bangkok, สิทธิ์ owner/member, invite แบบใช้ครั้งเดียว, การปัดเศษ, การหมุนเวรตามลำดับ และความหมายทางเทคนิคของอายุข้อมูลอยู่ใน [decisions](../project/decisions.md) และ [domain](../project/domain.md)

## นอก MVP ที่เสนอ

รับ/โอนเงินจริงผ่านแอป, payment gateway, wallet, การหักบัญชีธนาคาร, multi-currency, chat, APNs/Expo Push/local notifications ของแอพ iOS (LINE OA ยืนยันการจ่ายอยู่ในขอบเขตตาม R16), อ่านสลิปด้วย OCR แล้วอนุมัติแทน API และระบบทำงาน offline ที่แก้ยอดเงินได้ การหักส่วนผู้รับเงินเป็นการลงบัญชีค่าใช้จ่ายเท่านั้น

[Board](board.md) · [Checklist](../../checklist.md)
