# Team board — OurHoomu

อัปเดต 2026-10-12 · Scope ปัจจุบัน: ออกแบบ/เอกสาร/checklist เท่านั้น · Implementation: ยังไม่ได้รับอนุมัติ

Tech Lead เป็นผู้ดูแลสถานะและ checklist แหล่งพฤติกรรมคือ [requirements](requirements.md) แหล่งคำตัดสินคือ [decisions](../project/decisions.md)

| Ticket | ผลลัพธ์ | Owner role | Dependencies | Status |
|---|---|---|---|---|
| [SW-0002](tickets/SW-0002.md) | Design และเอกสารสำหรับ agents | tech-lead | คำตอบผู้ใช้ครบแล้ว | in_review |
| [SW-0003](tickets/SW-0003.md) | ตั้งค่า monorepo และ toolchain ที่รันได้ | platform-engineer | design approval | draft |
| [SW-0004](tickets/SW-0004.md) | สร้าง database contract และ tenant isolation | data-engineer | SW-0003 | draft |
| [SW-0005](tickets/SW-0005.md) | Google/Apple session และบ้านผ่าน API | backend-engineer | SW-0004 | draft |
| [SW-0006](tickets/SW-0006.md) | API บิล การหาร และงวดเงินสด | backend-engineer | SW-0004, SW-0005 | draft |
| [SW-0007](tickets/SW-0007.md) | ตรวจสลิปภายนอกและ private storage | backend-engineer | SW-0004, SW-0005, SW-0006 | draft |
| [SW-0008](tickets/SW-0008.md) | API เวรสามโหมดและกิจกรรมภายในแอป | backend-engineer | SW-0004, SW-0005 | draft |
| [SW-0009](tickets/SW-0009.md) | แอพ login บ้าน และ navigation | frontend-engineer | SW-0003, SW-0005 | draft |
| [SW-0010](tickets/SW-0010.md) | หน้าบิลและทยอยจ่าย | frontend-engineer | SW-0006, SW-0007, SW-0009 | draft |
| [SW-0011](tickets/SW-0011.md) | หน้าเวรและ inbox ภายในแอป | frontend-engineer | SW-0008, SW-0009 | draft |
| [SW-0012](tickets/SW-0012.md) | ตรวจรับ MVP และ security boundaries อย่างอิสระ | qa-engineer | SW-0007, SW-0010, SW-0011, SW-0013 | draft |
| [SW-0013](tickets/SW-0013.md) | Retention ทุกประวัติและแผน restore | backend-engineer | SW-0004, SW-0006, SW-0007, SW-0008 | draft |
| [SW-0014](tickets/SW-0014.md) | เตรียมและแจก TestFlight pilot | platform-engineer | SW-0012 | draft |

## Dependency / dispatch gates

- ทุก implementation ticket รอ full design approval; มี ticket ไม่ได้แปลว่า agent ถูกเปิด
- SW-0003 → SW-0004 → SW-0005; หลัง auth/schema ถูกตรวจรับแล้ว SW-0006, SW-0008 และ SW-0009 ทำขนานใน worktrees แยกได้
- SW-0007 รอ provider selection/credentials/retention evidence เมื่อเชื่อมของจริง; ส่วน mock ไม่ใช้ปิด provider acceptance
- SW-0010 รอเงินจริง/สลิป API และ shell; SW-0011 รอ chores API และ shell
- SW-0013 รอ domain implementations; SW-0012 ตรวจ pre-release integrated artifact (AC1a, AC2–AC7) หลัง FE/BE/retention พร้อม; SW-0014 ปิด AC1b จาก TestFlight จริงหลัง QA ผ่านและมี authorization ส่งภายนอก
- Backlog เป็นระดับผลลัพธ์ที่วางไว้ Tech Lead แบ่ง ticket ใหญ่เป็น slices ก่อน dispatch ได้ โดยรักษา acceptance/dependencies และขอผู้ใช้เมื่อ scope เปลี่ยน

## Checkpoint สำหรับ resume

- Objective: ส่ง design v0.1, provider comparison และ checklist ที่ตรงสถานะจริง
- Integration target: main ที่ baseline 6312fa6e02dc65969874d29b1474ecf4bdd9e0b8; user checkout อยู่ local
- Working branch: witchagorn/sw-0002-project-design ใน isolated Orca worktree
- Current ticket: SW-0002; reviewer ตรวจ artifact 6aeb4228dc9655cf27127cdc557025fbc62b2b85 แล้ว Lead แก้ F1–F3
- Runtime: run_7a5023711f3d / task_5e634b90baf7 / ctx_78ed611a3ddc; CLI /usr/local/bin/orca; worker settled/released/archived และ ack แล้ว
- Graft: NO_INDEXED_FILES; worktree map 0 files/0 symbols/0 edges; raw docs fallback
- Next action: focused checks → local integration/checks → cleanup → ส่งผู้ใช้ตรวจแบบ
- Product decisions pending: full design approval, provider selection และ external retention proof
- Runtime receipts/check results: [SW-0002](tickets/SW-0002.md), [review](reports/SW-0002-design-review.md), [Lead resolution](reports/SW-0002-resolution.md)

ประวัติ contributor guide ก่อนรอบนี้อยู่ใน commit 6312fa6 ไม่สร้าง ticket/runtime IDs ย้อนหลังขึ้นเอง
