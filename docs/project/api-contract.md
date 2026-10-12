# API contract v0.1 — Proposed

Base URL: รอ Cloudflare deployment ของ Elysia API ตาม [SW-0020](../team/tickets/SW-0020.md); logical routes ใต้ /v1 ยังเป็นข้อเสนอ ไม่ใช่ API ที่ deploy แล้ว Backend/data/FE ต้องตรึง OpenAPI และ identity/SQL transaction contract ก่อนทำคู่ขนาน

## กติกากลาง

- JSON + HTTPS; access token แบบ Bearer สำหรับทุก app route ยกเว้น auth bootstrap/refresh ที่ระบุ; LINE webhook ใช้ signature แยกตาม contract ด้านล่าง; slip download คืน binary stream ตาม contract ด้านล่าง

LINE OA addition: logical `POST /integrations/line/webhook` เป็น public HTTPS callback ตรวจ signature จาก raw body ก่อน parse และ deduplicate webhook event IDs; ไม่ใช้ app Bearer แทน signature ส่วน authenticated linking/unlinking routes และ group/DM DTO รอตรึงตามผู้รับที่ผู้ใช้เลือก ไม่รับ arbitrary LINE ID จาก client เป็นสิทธิ์ส่งข้อความ ดู [LINE OA design](line-oa.md)
- Server ใช้ session identity และ membership สด ไม่รับ user_id/house role จาก client เป็น authority
- IDs เป็น UUID; เงิน integer satang; bps integer; timestamp ISO 8601 UTC; วันเวร YYYY-MM-DD + timezone บ้าน
- Mutation ที่เสี่ยงซ้ำใช้ Idempotency-Key ผูก user + route + body hash; key เดิม/body ต่าง → 409; สำเร็จซ้ำคืน resource เดิม
- PATCH/status transition ใช้ expectedVersion; version เก่า → 409 และคืนสถานะปัจจุบันที่มีสิทธิ์เห็น
- List ใช้ cursor(created_at,id) หรือ occurrence local_date,id; default 20, maximum 100; ข้อมูลต้องไม่ข้ามบ้านและไม่หมดอายุ
- Success: { data, requestId }; list เพิ่ม nextCursor; error: { error: { code, message, fields? }, requestId }
- 400 validation, 401 session, 403 permission, 404 unavailable/out-of-scope, 409 duplicate/conflict, 410 expired resource ที่ผู้ใช้เคยมีสิทธิ์, 429 rate limit; ไม่คืน provider secrets/raw response
- Timeout provider อาจคืน 202 + attempt pending; ไม่ใช้ response success ของ transport เพื่อบอกว่าจ่ายแล้ว

## Routes ที่เสนอ

| Method / route | ผู้เรียก / ผล |
|---|---|
| POST /auth/challenges | public rate-limited; provider google/apple → one-time challenge/nonce metadata |
| POST /auth/exchange | public rate-limited; provider ID token + challenge proof → verified app session |
| POST /auth/refresh | refresh credential → rotated session; ถือ token เป็น secret |
| POST /auth/logout | session → revoke app session/refresh ตาม contract ที่เลือก |
| GET /me | ผู้ใช้ → profile และบ้านที่ตน active |
| DELETE /me | ผู้ใช้ยืนยันตัวตนซ้ำ → account deletion workflow; ต้องจัดการบ้าน/บิลค้างก่อน |
| POST /houses | ผู้ใช้ → บ้านและ owner membership แบบ atomic |
| GET /houses | ผู้ใช้ → บ้านของตน |
| GET/PATCH /houses/:houseId | สมาชิกอ่าน / owner แก้ชื่อและ timezone |
| GET /houses/:houseId/members | สมาชิก → public membership DTO |
| POST /houses/:houseId/invitations | owner → token ครั้งเดียวและ expiresAt; logs เก็บแค่ id |
| POST /invitations/accept | ผู้ใช้ + token → consume และ join atomic |
| DELETE /houses/:houseId/invitations/:id | owner → revoke |
| POST /houses/:houseId/leave | สมาชิก → ออกตามเงื่อนไข domain |
| DELETE /houses/:houseId/members/:id | owner → นำออกตามเงื่อนไขเดียวกัน |
| GET/POST/PATCH /me/recipient-accounts[/:id] | เจ้าของบัญชีเท่านั้น; ข้อมูลบัญชีไม่ลง logs |
| GET/POST /houses/:houseId/bills | สมาชิกอ่าน/สร้าง draft |
| GET/PATCH /houses/:houseId/bills/:billId | สมาชิกอ่าน; creator แก้ draft ด้วย expectedVersion |
| GET /houses/:houseId/bills/:billId/recipient-accounts?recipientMembershipId=:id | draft creator เท่านั้น → บัญชีที่เลือกได้ของ active recipient ในบ้านเดียวกันแบบ masked DTO |
| POST /houses/:houseId/bills/:billId/publish | creator → authoritative shares/self-covered snapshot |
| POST /houses/:houseId/bills/:billId/void | creator → void เฉพาะไม่มี confirmed installment |
| POST /houses/:houseId/bills/:billId/payments | ผู้จ่ายของ share ตนเอง → attempt method/amount/reservation |
| GET /houses/:houseId/bills/:billId/payments | สมาชิก → summary DTO เท่านั้น |
| POST /payments/:attemptId/slip-upload | uploader → private upload URL/path ที่กำหนดจาก server |
| POST /payments/:attemptId/verify | uploader → ตรวจ stored artifact; confirmed/pending/rejected |
| POST /payments/:attemptId/reconcile | uploader/recipient → คำขอตรวจสถานะเดิม มี cooldown/limit |
| POST /payments/:attemptId/confirm-cash | bill creator → ยืนยันงวดเงินสด |
| POST /payments/:attemptId/reject-cash | bill creator → ปฏิเสธพร้อมเหตุ |
| POST /payments/:attemptId/cancel | payer → ยกเลิกก่อนยืนยันตาม state |
| GET /payments/:attemptId/slip | uploader หรือ recipient ที่ยังเป็นสมาชิก → authenticated binary stream; ตรวจสิทธิ์/expiry สดทุก request ไม่คืน Storage URL |
| GET/POST /houses/:houseId/chore-schedules | สมาชิก → ดู/สร้าง schedule |
| POST /houses/:houseId/chore-schedules/preview | สมาชิก → preview rule โดยไม่บันทึก |
| PATCH /houses/:houseId/chore-schedules/:id | creator/owner → revision สำหรับอนาคต |
| GET/POST /houses/:houseId/chores | สมาชิก → ดู/สร้าง manual occurrence; GET ขยาย rule idempotently |
| PATCH /houses/:houseId/chores/:id | creator/owner → assignment/cancel ของรายการอนาคต |
| POST /houses/:houseId/chores/:id/complete | assignee → completed + event atomic |
| POST /houses/:houseId/chores/:id/reopen | assignee → undo + event atomic |
| GET /houses/:houseId/dashboard | สมาชิก → balances, pending actions, today's chores, freshness |
| GET /houses/:houseId/activity | สมาชิก → privacy-filtered feed |
| POST /houses/:houseId/activity/read | สมาชิก → bounded read cursor |

Path ที่ไม่มี houseId ต้อง resolve parent → live membership → private viewer permission ก่อนอ่าน/เขียนเสมอ URL มี id ถูกต้องไม่ได้แปลว่ามีสิทธิ์

## การเลือกบัญชีของผู้รับเงิน

การจัดการบัญชี /me/recipient-accounts เป็น owner-only เสมอ ส่วน draft-scoped selector ให้ creator ที่ยังเป็นสมาชิกเลือกบัญชีของตนหรือสมาชิก B ที่เลือกเป็น recipient ได้ โดยต้องเป็น draft ของตนและ B ยัง active ในบ้านเดียวกัน ไม่เปิด directory บัญชีทั้งบ้าน

คืนเฉพาะบัญชีที่เปิดใช้งานและใช้กับ provider matching ที่เลือกได้ เป็น DTO { id, version, bankCode, label, maskedAccount, isDefault } ไม่คืนเลขเต็ม/รายละเอียดส่วนตัว ไม่ใช้ข้อมูล masked เป็นหลักฐานตรวจสลิป ไม่มีบัญชีที่ใช้ได้ให้คืนรายการว่างพร้อม reason=recipient_account_required; UI ขอให้ B ตั้งค่าบัญชีก่อน publish ไม่มีสิทธิ์แก้บัญชีแทน B

Publish ส่ง recipientAccountVersion จาก selector และ validate ใน transaction เดียวว่า recipient ยัง active, account ยังเปิดใช้และเป็นของ recipientMembershipId จริง รวมถึง version ตรงก่อนสร้าง snapshot; ID ที่เดาเอง/ของคนอื่นใช้ไม่ได้ คืน 409 recipient_account_unavailable เมื่อบัญชีเปลี่ยนหรือใช้ไม่ได้ ผู้ร่วมบิลที่ต้องชำระและ recipient เท่านั้นจึงรับข้อมูลปลายทางเต็มตาม published bill DTO; creator ที่ไม่ต้องจ่ายและไม่ใช่ recipient เห็นเฉพาะ masked metadata

## การดาวน์โหลดสลิป

API ตรวจ session, live membership, uploader/recipient และ parent expiry จากสถานะปัจจุบันทุก request แล้วอ่าน private Storage ผ่าน backend และ stream bytes กลับ ไม่ redirect หรือคืน bearer read URL ใช้ Cache-Control: private, no-store; client อ่านผ่าน authenticated fetch และแสดงจาก memory โดยล้างเมื่อออกจากบ้าน/logout/หมดอายุ ไม่มี persistent image cache

คำขอดาวน์โหลดใหม่หลัง removal/leave/expiry ต้องถูกปฏิเสธ แม้เคยดาวน์โหลดสำเร็จ; ไม่อ้างว่าเพิกถอนสำเนาที่ผู้ใช้บันทึกไปแล้วหรือ bytes ที่เริ่มส่งก่อนเพิกถอนได้ Signed URLs ใช้เฉพาะ upload ที่จำกัด path/expiry และต้องตรวจ membership อีกครั้งก่อน finalize

## ตัวอย่าง publish bill

```json
{
  "title": "ค่าใช้จ่ายส่วนกลาง",
  "totalSatang": 20000,
  "currency": "THB",
  "recipientMembershipId": "uuid-a",
  "recipientAccountId": "uuid-account",
  "recipientAccountVersion": 1,
  "participants": [
    { "membershipId": "uuid-a", "basisPoints": 5000 },
    { "membershipId": "uuid-b", "basisPoints": 5000 }
  ],
  "expectedVersion": 1
}
```

ตัวอย่าง IDs เป็น labels เพื่ออธิบาย contract ไม่ใช่ UUID ที่ใช้เรียก API ได้จริง ผลจริงต้องให้ A amountSatang=10000/selfCovered=true/outstandingSatang=0 และ B outstandingSatang=10000; เมื่อ B confirmed 4000 แล้ว remainingSatang=6000

## Slip provider adapter

Normalized result: verification status, provider attempt id, bank transaction reference, actual amountSatang, transactionAt, recipient matching outcome และ error classification เก็บเฉพาะค่าจำเป็นใน private tables ไม่ให้ frontend ตัดสินผล

Provider key, DATABASE_URL และ Neon storage credentials อยู่ใน backend secrets; ไม่มีใน EXPO_PUBLIC_* Backend ส่งไฟล์ที่อยู่ใน storage ของตน ไม่ fetch URL ตาม body

provider error classes: invalid, mismatch, bank_delayed, quota_exhausted, rate_limited, timeout_unknown; mapping ไป domain state ต้องมี fixtures/contract tests จาก provider ที่เลือก ไม่ hardcode ว่า HTTP 200 = verified

Public result ให้ payer/recipient เห็นเหตุที่ช่วยแก้ ไม่ส่งชื่อบัญชี/รายละเอียดของธุรกรรมคนอื่นเมื่อ duplicate globalreference แยก provider duplicate ของคำขอเดิมจากการนำสลิปเดิมใช้ใหม่

## Acceptance ก่อนตรึง contract

ทดสอบ schema เงิน/เปอร์เซ็นต์, routes ข้ามบ้าน, private DTO, idempotency, refresh race, invite consume race, duplicate transfer finalize และ retention boundary รวม creator != recipient: เลือกบัญชี B ผ่าน masked selector, ไม่มีบัญชี, เปลี่ยน/ปิดบัญชีก่อน publish, ปลอม account ID และ download ใหม่หลังออกจากบ้าน Backend/data ต้องตกลง transaction และ errorcodes ก่อน FE ต่อของจริง การผ่าน mock ไม่ใช่หลักฐาน integration
