# SW-0002 — Lead resolution

วันที่ 2026-10-12 · ขอบเขต: เอกสารเท่านั้น · Writer: Tech Lead

[รายงานผู้ตรวจ](SW-0002-design-review.md) เป็นหลักฐาน immutable artifact 6aeb422 เทียบ 6312fa6 และคง verdict เดิม changes_requested ไว้ตามจริง ไม่แก้ย้อนหลังให้ดูเหมือน reviewer ผ่าน revision ที่ยังไม่ได้ตรวจ

## การแก้ findings โดย Lead

| Finding | คำตัดสินและผลแก้ | หลักฐานในเอกสารปัจจุบัน |
|---|---|---|
| F1: signed read URL ขัดกับเพิกถอนทันที | ใช้ authenticated API binary stream ตรวจ membership/expiry สดทุก request, no-store, ไม่มี direct read URL; รับรองเฉพาะคำขอใหม่ ไม่เรียกคืนสำเนาที่ผู้ใช้มีแล้ว | [API download](../../project/api-contract.md), [privacy/domain](../../project/domain.md), [architecture](../../project/architecture.md), SW-0007/SW-0010/AC5 |
| F2: QA ต้องมี TestFlight ก่อน release | แยก AC1a development-device auth เป็น pre-release gate ของ SW-0012; AC1b TestFlight install/smoke ปิดภายหลังใน SW-0014 | [Requirements](../requirements.md), [QA](../tickets/SW-0012.md), [TestFlight](../tickets/SW-0014.md), [operations](../../project/operations.md), [board](../board.md) |
| F3: เลือกบัญชี B โดย creator A ไม่มี contract | เพิ่ม draft-creator-only masked account selector จำกัด selected active recipient ในบ้านเดียวกัน; no account → ขอ B ตั้งค่าก่อน publish; publish ตรวจ owner/active/version พร้อม snapshot ใน transaction | [API selector](../../project/api-contract.md), [UX](../../project/ux.md), [accounts](../tickets/SW-0005.md), [bills](../tickets/SW-0006.md), [frontend](../tickets/SW-0010.md) |

ทั้งสามเรื่องแก้ภายใน scope การออกแบบ ไม่เปลี่ยน requirement ที่ผู้ใช้ยืนยัน Lead ตรวจ cross-document contract หลังแก้; ไม่มีการอ้างว่า reviewer ตรวจ revision หลังแก้หรือ runtime ผ่านแล้ว Full design ยังรอผู้ใช้ตรวจ

## Runtime settlement และหลักฐานถาวร

- Run run_7a5023711f3d / Task task_5e634b90baf7 / Dispatch ctx_78ed611a3ddc ส่ง worker_done msg_3cc1db9987ac พร้อมรายงานสำเร็จ
- เก็บรายงานเดิม SHA-256 `6dd21d596f1d418fcf95adff4ecc49ea8bdd39f939d03f1d052ed57ae03ff248` ใน `reports/SW-0002-design-review.md` และสำเนา `.git/ourhoomu-snapshots/sw-0002/independent-design-review.md` ก่อน release
- `/usr/local/bin/orca orchestration worker-release --dispatch ctx_78ed611a3ddc --json`: receipt e991fb27-3a24-40dc-b954-e87c7a7989f6 → state=released, processAction=closed_agent_terminal, archive=captured
- หลัง release จึง acknowledge delivery_f2539d0dcff0; receipt 1429f6cb-f9cf-4c0d-99fb-ddaef67a3a30 ยืนยัน acknowledged
- Reviewer actual process มี `--dangerously-bypass-approvals-and-sandbox` และใช้ inherited gpt-6.1-sol ตาม report; ไม่อ้าง config เพียงอย่างเดียวเป็น launch proof
- Graft 0.21.1 `graft map` ใน worktree หลังแก้ → 0 files/0 symbols/0 edges, **NO_INDEXED_FILES**; raw Markdown fallback ไม่มี token-savings claim

## Verification และ integration

ผล focused document checks, integration SHA และ cleanup เพิ่มที่ [SW-0002](../tickets/SW-0002.md) หลังรันจริง การตรวจรอบนี้เป็น Markdown paths/fences, ticket DAG, scope/whitespace และ consistency ของ F1–F3 ไม่มี application runtime หรือ provider/TestFlight proof

## ข้อจำกัดที่ยังต้องตัดสินก่อนพัฒนา/เปิดใช้จริง

Full design approval, slip provider/งบ, cash creator ที่จ่ายเอง และหลักฐานลบสำเนาจาก provider/backup/host เป็นรายการ pending ตาม [decisions](../../project/decisions.md) การส่งเอกสารไม่ปิด release gates เหล่านี้
