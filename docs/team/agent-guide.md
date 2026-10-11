# Agent guide

## ก่อนเริ่มงาน

1. อ่าน AGENTS.md → requirements.md → board.md → ticket ที่ได้รับ → design เฉพาะส่วน อ่าน checklist เพื่อเห็นภาพรวม ไม่ใช้ checkbox แทน acceptance evidence
2. Tech Lead ถามข้อไม่ชัด สรุป scope/acceptance และรอผู้ใช้ยืนยันก่อนเริ่มเขียนไฟล์หรือพัฒนา Workers ส่งคำถามผ่าน Tech Lead ไม่ถามผู้ใช้แยก สิทธิ์เดิมที่ยืนยันแล้วใช้ต่อได้ภายใน scope นั้น
3. รอบปัจจุบันอนุมัติเฉพาะเอกสาร ห้ามถือว่าการมี design/tickets คืออนุมัติ scaffold สร้าง credentials/cloud หรือเขียนแอพ
4. ทุก agent อ่าน Graft skill และ software-tech-lead/references/agent-runtime.md ตรวจ Graft ใน worktree งานก่อนค้น indexed source รายงาน ACTIVE/NO_INDEXED_FILES/UNAVAILABLE/ERROR พร้อมคำสั่งผลจริง ใช้ raw docs/config ได้เมื่อไม่ indexed
5. Tech Lead เลือก target branch จริง/baseSHA สร้าง isolated worktree ผ่าน Orca ตาม ownership Writer ขนานต้องคนละ checkout reviewer อ่านผลที่ freeze แล้วได้ Agent ใหม่ใช้ approval_policy=never/sandbox_mode=danger-full-access ตามคำสั่งผู้ใช้ ตรวจ launch จริงก่อนอ้าง effective

## แหล่งจริงและ ownership

| เรื่อง | Owner |
|---|---|
| Requirement, architecture/API contract, ticket readiness, board, checklist, merge/cleanup | Tech Lead |
| Schema, migrations, RLS, grants, transactional RPC | data-engineer |
| API handlers, auth/session, slip provider adapter, retention orchestration | backend-engineer |
| ourhoomu-front UI/native integration | frontend-engineer |
| Workspace/toolchain/CI, secret/build setup | platform-engineer |
| Independent QA/security/diff findings | ผู้ตรวจที่ไม่ได้เขียนส่วนที่ตรวจ |

Shared lockfile/config แก้โดย owner เดียวตาม ticket API/DTO และ schema ต้องตรึง revision ก่อน FE/BE ทำขนาน ถ้า contract ขัดกันให้หยุดเฉพาะส่วนที่พึ่งผลและแจ้ง Tech Lead ไม่เปลี่ยน requirement เอง

## ส่งงาน

Worker ส่ง commit/diff จริง รายงาน path ที่ Tech Lead เข้าถึงได้ คำสั่ง/ผล checks, acceptance ที่ผ่าน/ยัง pending, Graft/runtime evidence, blocker owner และ next action แยก mock จาก integration

OrcaTask/Dispatch/preamble เป็น authority ของ attempt ไม่แต่ง IDs ไม่ใช้ native subagent แล้วเรียกว่า Orca หลัง worker_done ต้อง idle Tech Lead เก็บ report ถาวรและ worker-release ก่อน ack ตาม guide

ผู้ตรวจรายงาน approve/changes_requested แยกจาก outcome ของ dispatch Reviewer ที่ทำหน้าที่เสร็จอาจส่ง succeeded พร้อม findings ได้ ยังไม่แปลว่า ticket ผ่าน

## ตรวจรับและอัปเดต checklist

Tech Lead เท่านั้นเปลี่ยน board/status/checklist:
- draft → ready เมื่อ scope ได้รับยืนยัน specs/deps/owner/worktree/required checks พร้อม
- in_progress → in_review เมื่อมี artifact จริง
- done เมื่อ acceptance และ required integrated checks ผ่าน พร้อม review evidence; mock ไม่ปิด integration criterion
- blocked ระบุเหตุ หลักฐาน ผู้ปลดล็อก next action และสถานะที่จะกลับไป

ติ๊ก[x]เฉพาะงานที่ตรวจรับแล้ว ใส่ ticket, artifact/commit และ verification ถัดจากรายการ แยก“ออกแบบเสร็จ”จาก“พัฒนาเสร็จ”และ“deploy แล้ว” อัปเดตทุกครั้งหลังรับงาน/รวมงาน อย่ารอจนจบทั้งโปรเจกต์

## Integration/cleanup

Tech Lead ตรวจ targetfreshness, diff และ dependencies รวม local ตาม authorization ที่ผู้ใช้ให้ ตรวจผลใน target แล้วเก็บ review/report/checkpoint ให้คงอยู่หลังลบ worktree

release เฉพาะ settled worker ที่มี receipt จริง ตรวจ tip อยู่ใน target, dirty/untracked/ignored files, activeworkers และ ownership ก่อน Orcaworktree rm ลบเฉพาะ worktree/branch ที่ทีมสร้าง งานไม่ชัดให้เก็บพร้อม blocker ไม่มีสิทธิ์ push/deploy จากการ merge local อย่างเดียว

## Resume

อ่าน requirements → board → active ticket → report แล้ว reconcileOrcaruntime/dispatch ที่มีอยู่ ไม่ launch ซ้ำจากความเงียบ ตรวจ pendingdecisions ใน project/decisions.md ก่อนปลด gate เก็บ checkpoint พร้อม next action ทุกครั้งที่หยุด
