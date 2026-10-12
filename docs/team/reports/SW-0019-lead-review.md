# SW-0019 — Tech Lead review และ final contract

วันที่ 2026-10-12 · Scope: database design documents; ไม่ใช่ implementation review หรือ production migration

## Author artifact และ ownership

Data Engineer ส่ง commit c6800a9a4cec88a0e2b0f02df19e024b21e4c22c (28 ตาราง) จาก Task task_3f8e18ed88aa / Dispatch ctx_1b7612887dd9 ใน Run run_223db0fa65d8 Outcome succeeded หมายถึงส่ง draft/report พร้อมตรวจรับ ไม่ได้ปิด ticket เอง

Tech Lead อ่านแบบ/รายงาน เก็บ original draft/report/diff/settlement ใน root `.git/ourhoomu-snapshots/sw-0019/` ก่อน worker-release แล้ว ack delivery_e93b0b96f8b7 ตาม receipt จริง หลัง settlement/release Tech Lead รับ ownership final architecture/data contract สำหรับการแก้ด้านล่างและเอกสารที่เกี่ยวข้อง ไม่มี concurrent writer และไม่มี worker รันต่อ

[Worker report](SW-0019-database-design.md) เป็นหลักฐานฉบับ author เดิม ข้อเสนอ W24h และ restore quarantine ที่กล่าวในรายงานนั้น **ถูกแทนด้วย final database §3.3** ไม่ใช้เป็นคำสั่ง implementation ล่าสุด ข้อความเปลี่ยนนโยบายถูกส่งในระหว่างงานแต่ยังไม่ปรากฏใน artifact ที่ worker ส่ง; Tech Lead ตรวจ artifact จริงแล้วแก้ก่อนรวม ไม่ถือ durable enqueue ว่าผู้รับนำไปใช้แล้ว

## Findings และผลแก้

| Finding | ผลใน final design |
|---|---|
| F1: W24h เพิ่มข้อจำกัดทั่วไปที่ผู้ใช้ยังไม่เลือก ขณะที่ global reference ไม่อยู่เกิน parent | ใช้ singleton transfer_replay_policy (ตารางที่29) และ monotonic replay_floor_at; advance ก่อน purge/early deletion และ restore fence ก่อนเปิด money; แสดง late-evidence/needs_attention tradeoff เป็น proposed gate ไม่มี manual transfer approve |
| F2: invite lock invite→house ขัดลำดับ house-first | resolve parent ก่อน lock แล้ว house→invite/recheck; transfer finalize/purge ใช้ replay-policy→house→parent→share→attempt; path อื่นไม่จับ singleton ภายหลังถือ house |
| F3: current chore/LINE FKs ไป left member ทำให้ลบ membership history ไม่ได้ | nullable creator/fixed/pool provenance, clear departed member slots โดยไม่เลื่อนตำแหน่ง rotation; generated creator NULL/owner authority; revoke bindings ที่ member/verified_by ออก; historical snapshots คงจน expiry |
| F4: HMAC digest rekey เป็น key ใหม่โดยไม่มี canonical reference ไม่ได้ | pin dedicated reference key หรือ freeze+advance floor ครอบคลุม retained timestamps แล้ว rotate ตาม tested protocol ไม่อ้าง rekey จาก hash อย่างเดียว |
| C1: legacy profiles→auth.users และ dedupe shorthand ใน domain | แทนด้วยลิงก์ final database/app-owned users และเปิด pending native-auth/runtime gate; ประกาศ dictionary aliases ให้ migration ใช้ table names เต็ม |

Review ครอบคลุม correctness (เงิน10000bps/ยอด0share/40+60/creator!=recipient/concurrency), maintainability (common column sets/typed tables), architecture (ฐานเดียว/backend transactions), security (composite tenant FK/private slip/live membership) และ operational limits (expiry/files/provider/LINE/backup/restore) R1–R16 มี mapping ในแบบ

## Verification และข้อจำกัด

Required checks: relative Markdown links/fences, ticket DAG, whitespace/scope และ source review ของ dictionary/invariants ตัวเลข allocation ตรวจซ้ำด้วย integer arithmetic แยกจาก SQL runtime ผล final counts/commit/integration/cleanup receipts เก็บใน root `.git/ourhoomu-snapshots/sw-0019/`

Graft ACTIVE: root map และ Lead isolated map พบ1 neon.ts/0symbols/1edge แต่เอกสารไม่ถูก index ใช้ raw document review; Lead retrieval2callsรายงาน13+13=26 saved tokens, worker map1call13 รวมทีม39; freshness checks ไม่มี savings ไม่รวม

ข้อจำกัด: final Lead contract corrections ผ่าน Lead review/static checks ยังไม่มี independent runtime/schema tests หรือ graphical Mermaid render ภายหลัง SW-0004 ต้องทดสอบ actual role/RLS, constraints, races, purge/restore/key rotation และ migrations บน synthetic sandbox ก่อน production; external recipient/retention proof ยัง pending ไม่อ้างว่าใช้ SlipOK/LINE จริงสำเร็จ

Verdict: รับ final **design artifacts** เมื่อ integrated checks ผ่าน ไม่ปิด SW-0004/SW-0018 หรืออนุมัติ pending product policies แทนผู้ใช้
