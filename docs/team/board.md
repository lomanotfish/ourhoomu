# Team board — OurHoomu

อัปเดต 2026-10-12 · Scope: เอกสาร MVP spec/backlog รวม SlipOK/LINE OA และ Neon setup/deploy เฉพาะ SW-0015 · Application implementation: ยังไม่ได้รับอนุมัติ

Tech Lead เป็นผู้ดูแลสถานะและ checklist แหล่งพฤติกรรมคือ [requirements](requirements.md) แหล่งคำตัดสินคือ [decisions](../project/decisions.md)

| Ticket | ผลลัพธ์ | Owner role | Dependencies | Status |
|---|---|---|---|---|
| [SW-0002](tickets/SW-0002.md) | Design และเอกสารสำหรับ agents | tech-lead | คำตอบผู้ใช้ครบแล้ว | done |
| [SW-0003](tickets/SW-0003.md) | ตั้งค่า monorepo และ toolchain ที่รันได้ | platform-engineer | SW-0015, SW-0022, SW-0024, design approval | draft |
| [SW-0004](tickets/SW-0004.md) | สร้าง database contract และ tenant isolation | data-engineer | SW-0003, SW-0022, SW-0024 | draft |
| [SW-0005](tickets/SW-0005.md) | Google/Apple session และบ้านผ่าน API | backend-engineer | SW-0004, SW-0024 | draft |
| [SW-0006](tickets/SW-0006.md) | API บิล การหาร และงวดเงินสด | backend-engineer | SW-0004, SW-0005 | draft |
| [SW-0007](tickets/SW-0007.md) | ตรวจสลิปภายนอกและ private storage | backend-engineer | SW-0004, SW-0005, SW-0006, SW-0023 | draft |
| [SW-0008](tickets/SW-0008.md) | API เวรสามโหมดและกิจกรรมภายในแอป | backend-engineer | SW-0004, SW-0005 | draft |
| [SW-0009](tickets/SW-0009.md) | แอพ login บ้าน และ navigation | frontend-engineer | SW-0003, SW-0005, SW-0025 | draft |
| [SW-0010](tickets/SW-0010.md) | หน้าบิลและทยอยจ่าย | frontend-engineer | SW-0006, SW-0007, SW-0009, SW-0025 | draft |
| [SW-0011](tickets/SW-0011.md) | หน้าเวรและ inbox ภายในแอป | frontend-engineer | SW-0008, SW-0009, SW-0025 | draft |
| [SW-0012](tickets/SW-0012.md) | ตรวจรับ MVP และ security boundaries อย่างอิสระ | qa-engineer | SW-0007, SW-0010, SW-0011, SW-0013, SW-0018 | draft |
| [SW-0013](tickets/SW-0013.md) | Retention ทุกประวัติและแผน restore | backend-engineer | SW-0004, SW-0006, SW-0007, SW-0008, SW-0023 | draft |
| [SW-0014](tickets/SW-0014.md) | เตรียมและแจก TestFlight pilot | platform-engineer | SW-0012 | draft |
| [SW-0015](tickets/SW-0015.md) | Neon CLI/skills/MCP/link/private slip policy/deploy | tech-lead | คำสั่งผู้ใช้ระบุ target/config แล้ว | done |
| [SW-0016](tickets/SW-0016.md) | เปลี่ยน provider ที่เลือกเป็น SlipOK ในเอกสาร | tech-lead | คำสั่งผู้ใช้เลือก SlipOK | done |
| [SW-0017](tickets/SW-0017.md) | ออกแบบ LINE OA แจ้งยืนยันการจ่าย | tech-lead | คำสั่งเพิ่มช่องทาง; ผู้รับยัง pending | done เฉพาะเอกสาร |
| [SW-0018](tickets/SW-0018.md) | LINE OA webhook/binding/outbox/push | backend-engineer | SW-0005, SW-0006, SW-0007, SW-0017 | draft |
| [SW-0019](tickets/SW-0019.md) | Database ERD/data dictionary/constraints/transactions | data-engineer + Tech Lead review | คำสั่งออกแบบ database; ไม่ใช่ migration | done เฉพาะแบบ |
| [SW-0020](tickets/SW-0020.md) | ยืนยัน Elysia/Drizzle/Cloudflare Free และ Expo/React Native/Bun tooling | tech-lead | คำสั่งเลือก stack ล่าสุด | done เฉพาะเอกสาร |
| [SW-0021](tickets/SW-0021.md) | รวม MVP spec และตรวจ backlog | tech-lead | SW-0020 และคำสั่งผู้ใช้ | done เฉพาะเอกสาร |
| [SW-0022](tickets/SW-0022.md) | Elysia Workers / Drizzle Neon transaction feasibility | research-engineer | SW-0020 | draft |
| [SW-0023](tickets/SW-0023.md) | Free tier scheduler / retention feasibility | research-engineer | SW-0020 | draft |
| [SW-0024](tickets/SW-0024.md) | Google Apple session / Neon actor contract | research-engineer | SW-0020 | draft |
| [SW-0025](tickets/SW-0025.md) | UX/UI ทุก flow ของ iOS MVP ใน Figma | uxui-designer | SW-0021 และคำยืนยันผู้ใช้ 2026-10-12 | in_progress |

## Dependency / dispatch gates

- ทุก application implementation ticket รอ full design approval, SW-0025 design artifact review และ Neon identity/driver/actor contract; SW-0025 ทำ design artifact เพื่อทบทวนเท่านั้น ไม่ถือว่าผู้ใช้ออกแบบอนุมัติแล้ว; stack ยืนยันตาม SW-0020 แล้ว; SW-0015 ได้รับอนุมัติ setup/deploy โดยเฉพาะ มี ticket ไม่ได้แปลว่า agent ถูกเปิด
- SW-0022/0023/0024 เป็น investigation tickets แยกจาก implementation; ผลวิจัยต้องผ่าน Tech Lead review ก่อนปลด dependencies งานเอกสารนี้ไม่ได้หมายถึงงานวิจัยเหล่านั้นเสร็จ
- SW-0022 + SW-0024 → SW-0003 → SW-0004 → SW-0005; SW-0023 → SW-0007/SW-0013; หลัง auth/schema ถูกตรวจรับแล้ว SW-0006, SW-0008 และ SW-0009 ทำขนานใน worktrees แยกได้
- SW-0019 ออกแบบ 29 ตารางแล้ว; SW-0004 ใช้ final [database contract](../project/database.md) และยังรอ design/policy/runtime approval ก่อน migrations/tests ไม่ใช้ original worker W24h proposal แทน final replay-floor design
- SW-0007 เลือก SlipOK แล้ว รอ credentials/งบ/recipient matching/retention evidence เมื่อเชื่อมของจริง; ส่วน mock ไม่ใช้ปิด provider acceptance
- SW-0010 รอเงินจริง/สลิป API และ shell; SW-0011 รอ chores API และ shell
- SW-0018 รอผู้รับ LINE/ข้อความ/binding/retention และ credentials; ก่อน release ต้องให้ SW-0012 ตรวจ AC10 และ SW-0014 ตรวจ scope LINE ตามที่อนุมัติ ไม่ถือว่าการเพิ่มเอกสารคือส่งข้อความจริงสำเร็จ
- SW-0013 รอ domain implementations; SW-0012 ตรวจ pre-release integrated artifact (AC1a, AC2–AC7, AC10) หลัง FE/BE/retention/LINE พร้อม; SW-0014 ปิด AC1b จาก TestFlight จริงหลัง QA ผ่านและมี authorization ส่งภายนอก
- Backlog เป็นระดับผลลัพธ์ที่วางไว้ Tech Lead แบ่ง ticket ใหญ่เป็น slices ก่อน dispatch ได้ โดยรักษา acceptance/dependencies และขอผู้ใช้เมื่อ scope เปลี่ยน

## Checkpoint สำหรับ resume

- Last completed: SW-0021 รวม MVP spec/backlog ตาม stack ล่าสุดแล้วโดยไม่แก้ product schema
- Integration target record: `local`; SW-0021 baseline `2c2b49e`, author tip `749f43e`, accepted at `82c3dbf`
- Completed: SW-0021 รวม MVP spec/backlog บน `local` ที่ `749f43e` แล้ว; acceptance, final checks และ cleanup receipt อยู่ใน ticket กับ root `.git/ourhoomu-snapshots/sw-0021/`; SW-0020 หลักฐานอยู่ root `.git/ourhoomu-snapshots/sw-0020/`
- Graft evidence for SW-0021: ACTIVE; isolated `graft build` และ `graft map` พบ neon.ts 1 file/0 symbols/1 edge; Markdown raw fallback; root checkpoint ก่อนหน้าอยู่ SW-0020
- Current: SW-0025 กำลังสร้าง Figma prototype ทุก flow ในไฟล์เดียว; Run `run_c0cb8ab739fb`, Task `task_79995c2fa29f`, Dispatch `ctx_d6b8735bc53e`; Tech Lead worktree `/Users/afe/orca/workspaces/ourhoomu/sw-0025-uxui-ticket`; UX/UI worker worktree `/Users/afe/orca/workspaces/ourhoomu/sw-0025-uxui-design`; Graft ACTIVE ก่อนค้นโค้ด, Markdown raw fallback
- Next action: Tech Lead review integrated Figma artifact; ผู้ใช้ทบทวน [MVP spec](../project/spec.md), Figma design revision และ product decisions ที่ยังเสนอ; ทำ SW-0022/0023/0024 ให้ผ่าน review ก่อน implementation ที่พึ่งผล
- Product decisions pending: full design, Neon Auth/driver integration, SlipOK credentials/งบ/recipient matching และ retention proof ของ provider/backup/branches
- SW-0016: ผู้ใช้เลือก SlipOK แล้ว; เอกสาร/requirements/SW-0007/checklist ตรงกัน ยังไม่เชื่อม API จริงหรือซื้อแพ็กเกจ
- Prior review: [SW-0002](tickets/SW-0002.md), [review](reports/SW-0002-design-review.md), [resolution](reports/SW-0002-resolution.md) คงเป็นประวัติของ revision เดิม ไม่ใช่ review ของ Neon revision นี้
- Final lifecycle receipts/inventory: root `.git/ourhoomu-snapshots/sw-0015/` และ `.git/ourhoomu-snapshots/sw-0021/` พร้อม Orca root comment; ไม่ลบ credentials/skills/user checkout ไปพร้อม isolated worktree

ประวัติ contributor guide ก่อนรอบนี้อยู่ใน commit 6312fa6 ไม่สร้าง ticket/runtime IDs ย้อนหลังขึ้นเอง
