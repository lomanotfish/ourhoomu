# SW-0019 — Data Engineer report

วันที่ 2026-10-12 · Outcome: design artifacts พร้อมให้ Tech Lead review; ไม่ใช่ schema implementation/runtime acceptance

## Dispatch, scope และ baseline

- Run `run_223db0fa65d8`; task `task_3f8e18ed88aa`; dispatch `ctx_1b7612887dd9`
- Worker terminal `term_28bf475e-8423-48d0-b9fd-df48a4525f9f`; coordinator `term_ad686f49-11c8-4697-a7ce-3dbb0f25dc4a`
- Exact worktree `/Users/afe/orca/workspaces/ourhoomu/sw-0019-database-design`
- Branch `witchagorn/sw-0019-database-design`; baseline verified by `git rev-parse HEAD`: `e26f65715e2f66879517a4cf4d1944de90700af1`
- Integration `main/local` เป็นของ Lead; ไม่มี merge/cleanup/ticket closure จาก worker
- Owned edits: [database design](../../project/database.md) และรายงานนี้เท่านั้น; untracked `docs/team/tickets/SW-0019.md` ของ Lead คงไว้และไม่ stage
- Delivery commit ใช้ subject `Design OurHoomu PostgreSQL database`; exact SHA ส่งผ่าน worker_done หลัง commit (ไม่ฝัง self-referential commit SHA ใน report)

## ผลออกแบบ

เอกสารภาษาไทยมี ERD/data flow, dictionary 28 ตารางพร้อม common column sets/nullability/default/PK/composite FK/unique/CHECK/index, requirement mapping R1–R16, transaction/lock order และตัวอย่าง 200 บาท 50/50 + 40/60 + creator ต่าง recipient + duplicate/concurrent finalize

แยก live authorization จาก FK, published recipient bank identity snapshot, recipient self-covered โดยไม่สร้าง payment, installment reservations/immutable confirmations, global reference claim, private slip/normalized verification, chore revisions/rotation/idempotent occurrences/completion events, activity/read cursors และ generic pending LINE bindings/outbox พร้อม retry key เดิมในหน้าต่างน้อยกว่า24h

Retention cap ทุก history child ตาม parent, maintenance jobs แบบ operational J ทำลบต่อหลัง access expiry ได้แต่ไม่เกิน original deadline, files/provider/backup/branches quarantine restore และ no automatic replay ไม่มี indefinite dedupe tombstone ยังไม่อ้างว่านโยบายเหล่านี้มีใน production

## Acceptance evidence สำหรับ Lead

| Ticket acceptance | Artifact / evidence | ข้อจำกัด |
|---|---|---|
| AC1 dictionary ครบ | database §2.1–2.5: 28 unique table names ผ่าน structural check | logical/physical design; ไม่มี DDL หรือ DB constraints ที่ deploy แล้ว |
| AC2 ERD/mapping/invariants/examples | §1 Mermaid 2 blocks, §3 transactions, §6 R1–R16/scenarios; integer arithmetic verification ด้านล่าง | concurrency/runtime tests อยู่ SW-0004 ภายหลัง |
| AC3 isolation/privacy/retention/pending | composite tenant FKs + frozen recipient triple, private viewer AND live membership, §3.3 dedupe horizon, §4–5 authorization/purge/restore | W/auth/LINE/SlipOK/retention gates ยัง pending; ไม่ใช้ข้ามแถว CHECK หรือ volatile expiry CHECK |
| AC4 Lead review/integration/cleanup | artifact พร้อมและ checks ด้านล่าง | Lead ต้องตรวจรับ รวมงาน อัปเดต board/checklist/index/legacy domain และ cleanup เอง |

## Verification ที่รันจริง

- อ่าน ticket, requirements, board, agent guide, domain, API, LINE, SlipOK, decisions และ ADR-0002; role TOML และ software-tech-lead/runtime + Graft skill
- Python standard-library structural check: local Markdown targets exist; 2 Mermaid fences balanced; 91 Markdown table rows column counts ตรงภายในแต่ละตาราง; dictionary28 unique names; R1–R16ครบ; ไม่มี tabs/trailing whitespace ผล exit0
- Integer arithmetic Python: 20000×5000/10000→10000/10000; 10001×3334/3333/3333→floor3334/3333/3333, remainders3334/3333/3333, allocation3335/3333/3333 รวม10001; 10000→3334/3333/3333 รวม10000; ตัวอย่างในเอกสารแก้ตรงผลจริง
- ตรวจ Markdown/Mermaid syntax และ semantics แบบ source review; **ไม่ได้เปิด graphical Markdown/Mermaid renderer** ไม่อ้าง pixel/render test
- `git diff --cached --check` และ `git diff --check`: final staged owned files ทั้ง2ไฟล์ผ่าน ไม่มี whitespace diagnostics (exit0); staged stat393insertions และ statusมีเฉพาะ2 owned additions + untracked ticketของLead
- ไม่รัน application tests เพราะไม่มี application executable/source หรือ behavior เปลี่ยน; ไม่รัน SQL/DDL, migration, Neon/cloud DB calls, install packages, config/env edits หรือส่งสลิป/LINE จริง
- Source verification: เปิด official PostgreSQL18 constraints/RLS/locking และ LINE retry ผ่าน web; Neon rendered page fetch error/Markdown content-type ไม่รองรับ จึงอ่าน `https://raw.githubusercontent.com/neondatabase/website/main/content/docs/connect/connection-pooling.md` ด้วย curl exit0 (official repo source; updatedOn2026-09-16)
- Verification helper รอบแรกสมมติทุก Markdown table มี2columnsจึง fail ที่ invariant table3columns; ปรับให้ตรวจ width ต่อ table แล้วผ่าน ไม่ใช่ defect ของเอกสาร `git diff --no-index --check /dev/null` exit1 เพราะไฟล์ใหม่มี diff และไม่มี whitespace diagnostics จึงเลือก staged checks เป็นหลักฐานสุดท้าย

## Graft และ permissions evidence

**🌱 Graft: ACTIVE** — exact ticket worktree; `graft --version` exit0 → `0.21.1`; `graft map` exit0 → 1 file (`neon.ts`), 0 symbols, 1 edge; output แจ้ง copied graph from main checkout แล้ว `graft check` ใน worktree exit0 ยืนยัน wiring graph in sync เอกสารไม่อยู่ใน index จึง raw-read docs ตาม fallback ไม่ใช้ graph จาก checkoutอื่นแทนผล worktree

`graft check` ที่ preflight/checkpoint/final เป็น freshness only, deep meaning tierยังไม่ได้ build (neon.ts pending1 node) ไม่มีการอ้าง summarized source retrieval หรือ build --deep; map เป็น retrieval1call มีตัวเลข **tokens saved ≈13** จาก tool จริง checks ไม่มีตัวเลขจึงไม่รวม savings และไม่มีการประมาณเอง

Worker-specific process evidence: `ps -o pid=,ppid=,command= -p $$,$PPID` จาก tool shell แสดง parent PID17378 argv `codex --no-daemon --dangerously-bypass-approvals-and-sandbox`; role TOML configured `approval_policy="never"`, `sandbox_mode="danger-full-access"` ตรง injected effective permissions ของ session ใช้หลักฐาน processนี้ ไม่อ้างจาก processรวมทั้งเครื่อง Full accessไม่ขยาย ownership

🌱 graft saved ~13 tokens (1 retrieval call; freshness checksไม่รายงาน savings)

## Findings, pending gates และ next action

1. **Dedupe/retention gap ใน domain shorthand:** `transaction_at>=bill.created_at` อย่างเดียวไม่กัน reuse กับบิล B ที่เก่ากว่าแต่ยังอยู่หลัง A purge แบบเสนอ W=24h acceptance horizon + original parent expires>=transferAt+W + retain reference through parent expiry ทำให้ทุกบิลปฏิเสธธุรกรรมหลัง guard purge โดยไม่เก็บhashถาวร ต้องอนุมัติ W/clock/late-transfer UX ก่อน implementation; หากไม่รับข้อจำกัดนี้ต้องออกแบบทางเลือกที่พิสูจน์เงิน+retentionได้ ไม่อ้าง provider duplicate อย่างเดียว
2. **Legacy domain profiles→auth.users:** ไม่ใช้ในแบบใหม่; Lead แจ้งว่าจะปรับ summary ให้ app users/issuer-subject mapping หลัง delivery ตาม ownership ไม่ invent Neon managed table columns Exact native Google/Apple/session/refresh/linking/runtime/SQL transportยัง pending
3. **LINE:** recipients/binding/message/privacy/external copies/credentialsยัง pending Generic DM/group/room tablesไม่หมายถึงอนุมัติส่งทุกแบบ; dispatch disabledจน gateผ่าน ไม่มีข้อความจริง
4. **SlipOK:** sufficient dynamic-recipient proof/reference/time precision/retention/credentials/งบยัง pending; masked identity/HTTP200ไม่ใช่ proof; ไม่มี manual transfer approve
5. **Retention:** ต้องพิสูจน์ object versions/provider/backups/branches deletion และ restore ledger recoveryจริง; money finalizationหลังrestoreต้อง quarantineตลอดW+toleranceหลังwritersเดิมหยุดและreconcileledger ไม่มี exactly-once end-to-end LINE claim
6. **Other proposal gates:** cash creator self-confirm, operational reservation/lease/retry/cap values, idempotency replay windowสำหรับnon-historymutations, full design approvalยังไม่ยืนยัน

Ownerของ pending decisionsคือTech Leadผ่านผู้ใช้/ผู้เชี่ยวชาญที่เกี่ยวข้อง งานเอกสารไม่มี blockerที่ต้องหยุดส่งมอบ; application implementation/releaseยังมี gates ข้างต้น Leadควร review W/restore protocol และ transaction/tenant contracts, ปรับ active docs/index ที่ตน own แล้วรวม commit ใน target/ตรวจ integrated linksก่อนยืนยันAC4 ไม่ปิด SW-0004 หรือ SW-0018 จากรายงานนี้
