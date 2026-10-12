# Domain และ data model v0.1

รายละเอียดนี้เป็นข้อเสนอที่ต้องตรวจพร้อม design v0.1 ก่อนใช้เป็น implementation contract

## บ้านและสมาชิก

User มีได้หลาย House ผ่าน HouseMembership; สมาชิกเป็น owner/member ผู้สร้างบ้านเป็น owner ต้องเหลือ active owner อย่างน้อยหนึ่งคน การเชิญ/นำสมาชิกออกเป็นสิทธิ์ owner

Invite token สุ่มด้วย secure RNG เก็บเพียง digest ใช้ได้ครั้งเดียว อายุ 7 วัน เมื่อรับให้สร้าง membership กับ consume invite ใน transaction เดียว ผู้ใช้ที่เป็นสมาชิกแล้วต้องไม่เพิ่มซ้ำและไม่ใช้สิทธิ์เชิญโดยไม่ตั้งใจ ตรวจ invite ก่อน redirect หนึ่งบ้าน

ออกจากบ้าน/ถูกนำออก: เสียสิทธิ์ API และคำขอดาวน์โหลดสลิปใหม่ทันที ล้าง client cache; ไม่อ้างว่าเรียกคืนสำเนาที่ดาวน์โหลดไปแล้วหรือ bytes ที่เริ่มส่งก่อนเพิกถอนได้ ประวัติที่ยังไม่หมดอายุยังแสดงชื่อ snapshot ให้คนที่มีสิทธิ์ ผู้รับเงินหรือผู้สร้างบิลที่มีบิลค้างต้องเคลียร์/ยกเลิกก่อนออกจากบ้านใน MVP ไม่ให้โอน ownership ของบิลที่เผยแพร่แล้วเงียบ ๆ สมาชิกอื่นออกได้แต่ยอดที่ติดอยู่ยังคงในประวัติของบ้าน ไม่สร้าง assignments ใหม่ให้คนที่ออก

## บิลและการหาร

Bill มี creator_id และ recipient_id แยกกัน ผู้รับเงินต้องเป็น active member และเป็นคนออกค่าใช้จ่ายทั้งหมดไปก่อน แอพลงบัญชีการคืนเงิน ไม่ได้หักหรือโอนเงินจริง

- เงินเป็น integer สตางค์ (THB) ยอดรวมมากกว่า 0; กำหนดเพดาน safe integer ที่ API/schema ตรงกันตอนสร้าง contract
- เปอร์เซ็นต์เป็น integer basis points (bps): 100% = 10,000; ผู้หารแต่ละคนมากกว่า 0 และรวมเท่ากับ 10,000
- ไม่รับ participant ซ้ำหรือสมาชิกข้ามบ้าน ผู้ที่ไม่ร่วมจ่ายไม่ต้องมี share
- ผู้รับเงินจะมี share หรือไม่ก็ได้ ถ้ามี share ให้ mark self_covered ตอน publish โดยไม่สร้าง transfer/cash payment; ถ้าไม่มี share มีส่วนตนเอง 0
- Creator ไม่ได้ถูก self_covered เว้นแต่เป็น recipient ด้วย
- แบ่งเท่ากันเป็น shortcut ที่แปลงเป็น bps ซึ่งรวม 10,000 เสมอ; UI แสดงค่าจริง ไม่แสดง 33.33% สามคนแล้วอ้างว่ารวม 100%
- Bill draft แก้ได้; publish สร้าง snapshot ของ shares และบัญชีรับเงิน ตรึง total/participants/recipient/account หลังเผยแพร่
- ยกเลิก published bill ได้เฉพาะก่อนมีงวดยืนยัน; cancel pending attempts พร้อมประวัติ ผู้มีเงินยืนยันแล้วต้องใช้ flow แก้บัญชีที่ออกแบบเพิ่มเติม ไม่ลบ/แก้ payment ย้อนหลัง

### การปัดเศษที่เสนอ

คำนวณ floor(total_satang × bps / 10000) ของแต่ละคน แล้วแจกสตางค์ที่เหลือตาม fractional remainder มากไปน้อย หากเท่ากันใช้ membership UUID เรียงเพื่อให้ผลเดิมทุกครั้ง ใช้ integer arithmetic/BigInt ไม่ใช้ binary floating-point เป็นแหล่งจริง

ตัวอย่าง 100.00 บาท กับ bps 3334/3333/3333 → 33.34/33.33/33.33 บาท รวม 100.00; การกรอกเอง 33.33/33.33/33.33% ถูกปฏิเสธเพราะรวม 99.99%

### ยอดที่แสดง

share_remaining = share_amount − sum(confirmed installments) สำหรับผู้รับเงินเป็น 0 จาก self_covered ส่วนคนอื่นเริ่มที่ share_amount ยอดที่รอตรวจ/รอรับเงินสดไม่ลด remaining แต่แสดง pending แยก และต้องนับ reservation ก่อนรับงวดใหม่เพื่อป้องกันส่งเกินยอด

ตัวอย่างที่ผู้ใช้ยืนยัน: 200 บาท A รับเงิน 50% B 50% → A self_covered 100, B outstanding 100 → B โอนยืนยัน 40 เหลือ 60 → B เงินสด 60 รอ creator ยืนยัน → ยืนยันแล้วเหลือ 0 และบิล settled

bill status: draft → open → settled หรือ voided; overdue คำนวณจาก due date และยอดค้าง เป็น badge ไม่ใช่การเปลี่ยนเงิน

## งวดการจ่ายและสลิป

PaymentAttempt หนึ่งรายการต่อหนึ่งงวด ผู้จ่ายเป็นผู้ใช้ที่มี share ของตนเอง; ไม่จ่ายแทนสมาชิกอื่นใน MVP amount > 0 และไม่เกิน remaining หลังหัก reservations ไม่มีการใช้สลิปเดียวแบ่งหลายบิล

### เงินโอน

1. สร้าง attempt และ reserve จำนวนที่ต้องการจ่ายแบบ atomic ด้วย Idempotency-Key
2. API ออก upload target สำหรับสลิปนั้น ผู้จ่ายอัปโหลดรูป JPG/PNG/WEBP ไม่เกิน 5 MB แอพช่วยบีบอัดโดยรักษา QR อ่านได้
3. finalize upload ตรวจ content/file size จริง ไม่เชื่อ extension หรือ client MIME; กัน overwrite หลัง finalize
4. ส่ง bytes/QR ให้ provider จาก backend เท่านั้น ไม่รับ URL ใด ๆ จาก client ไป fetch ป้องกัน SSRF และไม่ส่ง public URL ของสลิป
5. ยืนยันเมื่อ provider พบธุรกรรมจริง, จำนวนตรงงวด, ผู้รับตรง snapshot ของบิล, timestamp หลังสร้างบิลและไม่เป็นอนาคตเกิน clock tolerance, และ bank reference ยังไม่ถูกใช้
6. ล็อก share และ unique reference เมื่อ finalize; เพิ่ม confirmed credit ครั้งเดียว พร้อม event แล้ว release reservation
7. สลิปที่ไม่ตรงถูก rejected โดยไม่ลดหนี้; timeout/ธนาคารล่าช้า/provider quota เป็น pending_verification/needs_attention โดยไม่ลดหนี้ ไม่เปิด manual approve โอนแทนการตรวจ API

สถานะ: awaiting_upload → verifying → confirmed / rejected / pending_verification / needs_attention; retry/reconcile ต้องใช้ attempt เดิม ตรวจ bank reference กับผล provider ก่อนคิดว่า duplicate คือการทุจริต เพราะคำขอเดิมอาจสำเร็จแต่ response สูญหาย ถ้าทราบผลสำเร็จเดิมให้ finalize ได้ครั้งเดียว

ให้ reserve มี timeout ที่ระบุใน contract ตอน implementation; unknown ต้องไม่ถูกแปลงเป็น confirmed หรือส่งตรวจใหม่ไม่จำกัด สำหรับผลจริงที่เกิน remaining (เช่นสถานะเปลี่ยนระหว่าง network call) ให้ needs_attention ไม่เพิ่มเครดิตเกิน share และแสดงเหตุ ไม่ตีความว่าไม่มีเงินโอนเกิดขึ้นจริง

### เงินสด

ผู้จ่ายส่งคำขอจำนวนเงิน creator เป็นคน confirm/reject ตามที่ผู้ใช้กำหนด แม้ creator ไม่ใช่ recipient ผู้รับเงินเห็นสถานะและยอด แต่ไม่ได้สิทธิ์ยืนยันแทน creator

awaiting_confirmation → confirmed / rejected; confirm ทำ atomic และ idempotent ผู้จ่ายยกเลิกได้เฉพาะยังไม่ยืนยัน ยอดเกิน remaining ต้องไม่เครดิตเพิ่ม การยืนยันของ creator ที่เป็นผู้จ่ายเองเป็น decision ที่ต้องตรวจใน design review ตามรายการรอยืนยัน

### Privacy

ภาพสลิปและ normalized provider details อ่านได้เฉพาะ uploader และ recipient ที่ยังเป็นสมาชิกบ้าน ข้อกำหนดนี้ override owner role และ creator role ภาพส่งผ่าน authenticated API ที่ตรวจ membership/expiry สดทุก request ไม่คืน reusable Storage read URL

สมาชิกบ้านอ่านชื่อบิล รายการผู้หาร จำนวน/ยอดที่ยืนยันและสถานะรวมได้; cash creator เห็นจำนวนที่ต้องยืนยันได้ แต่ไม่ได้เห็นภาพสลิปที่ตนไม่มีสิทธิ์ API ต้องใช้ explicit DTO projection ไม่ SELECT * ของ payment/private detail

บัญชีผู้รับ snapshot ใช้สำหรับโอนและตรวจ matching เปิดเฉพาะผู้ร่วมบิลที่ต้องใช้จ่าย แสดงเลข masked ในรายการ; ผู้รับจัดการบัญชีตนเอง ค่าเปลี่ยนหลัง publish ใช้กับบิลใหม่เท่านั้น การตรวจต้องอาศัย identifier ที่ยืนยันได้ ไม่ใช้ชื่อคล้ายกันหรือเลขท้ายไม่กี่หลักเป็นหลักฐานพอเพียง

ก่อน publish ให้ draft creator ดูเฉพาะ eligible account ID และ metadata แบบ masked ของ recipient ที่เลือกในบ้านเดียวกันผ่าน draft-scoped selector ไม่เห็นเลขเต็มเมื่อไม่มีหน้าที่จ่ายและไม่มีสิทธิ์แก้บัญชีของผู้อื่น ถ้าไม่มีบัญชีที่ใช้ได้ต้องให้ recipient ตั้งค่าก่อน publish; ตรวจ account ownership/active revision พร้อม snapshot แบบ atomic

## เวรงานบ้าน

ChoreSchedule เป็น template, ChoreOccurrence เป็นงานของวันนั้น หนึ่ง occurrence มีหนึ่งผู้รับ สามารถมีหลายงาน/หลายคนต่อวันโดยสร้างหลาย occurrence

| Mode | กติกาที่เสนอ |
|---|---|
| manual | เลือกวันที่ งาน และ assignee โดยตรง |
| repeat | รายวันหรือรายสัปดาห์/วันในสัปดาห์ assignee คงเดิม |
| rotation | กำหนดวันและรายชื่อเรียงลำดับ วนหนึ่งคนต่อ occurrence เดินตามวัน ไม่เดินตามการกดเสร็จ |

Schedule เก็บ timezone บ้าน, start/end date, weekdays, assignee pool, revision และ anchor ไม่รีเซ็ต index การหมุนทุกครั้งที่เปิดแอป สร้าง occurrence ล่วงหน้า 30 วันและขยาย idempotently เมื่อเปิดหน้าเวร โดย unique(schedule_id, local_date) สำหรับ rule หนึ่งครั้งต่อวัน

ก่อนบันทึกแสดง preview ที่แก้ได้ การแก้ template ใช้กับอนาคตที่ยังไม่ทำ; งาน completed/past คง snapshot เดิม การเอาสมาชิกออกไม่ลบงานย้อนหลัง งานอนาคตที่ยังไม่เริ่มของคนนั้นให้ unassigned และแจ้งในแอปให้ผู้สร้างตารางแก้ ไม่เลือกคนแทนเงียบ ๆ

pending → completed โดย assignee เท่านั้น; schedule creator/owner จัด assignment/cancel ได้ assignee undo completion ของตนได้พร้อม event ภายในรายการที่ยังไม่หมดอายุ overdue คำนวณเมื่อวันผ่านและยัง pending ไม่มีรูปถ่ายบังคับ

## แจ้งในแอป

เมื่อเปิดแอป กลับ foreground หรือ pull-to-refresh API คืนยอดค้าง เงินสดรอยืนยัน สลิปที่ต้องตรวจซ้ำ เวรวันนี้/เลยกำหนด และกิจกรรมที่สมาชิกทำเสร็จ ใช้ ActivityEvent + read cursor/badge ภายในแอป ไม่มี APNs, Expo Push, local notifications, notification permissions หรือ background alert delivery

API บังคับ scope ก่อนคืน feed; กิจกรรมแสดงสถานะตามสิทธิ์ ไม่แนบภาพสลิป/ข้อมูลธนาคารส่วนตัวใน feed

## Retention: ประวัติทุกอย่างตั้งแต่วันสร้าง

ขีดสูงสุดทางเทคนิคที่เสนอคือ 365 วันจาก server-created UTC timestamp ไม่มีการเลื่อน expiry เมื่อแก้/จ่าย/ทำเสร็จ/restore ผู้ใช้ยืนยันว่าเริ่มนับจากสร้างและรวมบิลค้าง

- Bill aggregate: retention_deadline_at = bill.created_at + 365 days; expires_at = retention_deadline_at − 24 hours เป็นเวลาเริ่มปิดการเข้าถึงและลบ; shares, payments, slip files, provider details, attempts และ events ต้องถูกลบไม่ช้ากว่า deadline ของ bill นี้ แม้งวดถูกสร้างใกล้ครบปี
- Chore occurrence: retention_deadline_at = occurrence.created_at + 365 days และ expires_at ก่อนหน้านั้น 24 ชั่วโมง; completion events ไม่อยู่เกิน occurrence
- Events ที่ไม่มี parent: ใช้ deadline จาก created_at + 365 days และ access expiry ก่อน 24 ชั่วโมงเช่นกัน; invitation ใช้อายุสั้นกว่านี้
- Current profile, active membership, บ้าน, บัญชีรับเงินที่ใช้งาน และตารางเวรที่ยัง active เป็น current state ไม่ใช่ประวัติ ไม่บังคับลบทิ้งเมื่อผู้ใช้ยังใช้งาน; เมื่อเลิกใช้ให้แยก archived snapshot ที่มี expiry
- API/query/RLS ปฏิเสธข้อมูลที่ now >= expires_at ทันที รวมคำขอดาวน์โหลดสลิปใหม่ผ่าน authenticated API; signed upload URL ต้องหมดอายุไม่เกิน expiry และไม่เกิน 60 วินาที ไม่เลื่อนอายุ parent ด้วยการสร้าง child ใหม่
- แสดงวันข้อมูลถูกลบและรายการค้างใกล้ครบปีในแอปเมื่อเปิด ไม่มีการแจ้งเตือนนอกแอป ไม่มีการ roll ยอดค้างไปเป็นบิลใหม่อัตโนมัติเพื่อเลี่ยง retention
- Physical purge เริ่มเมื่อ expires_at ถึงกำหนด งานรันทุกชั่วโมงและ retry ต้องเสร็จก่อน retention_deadline_at; UI แสดงวันที่เริ่มลบ ไม่รับรองว่าจะเก็บเต็ม 365 วัน การเผื่อ 24 ชั่วโมงยังไม่ใช่ guarantee หาก host หยุดทำงาน ต้องพิสูจน์ operations gate ก่อนใช้จริง
- ไฟล์ Storage ต้องถูกลบผ่าน Storage API ก่อนลบ metadata, retries เป็น durable jobs พร้อม alert ให้ผู้ดูแลระบบ (operational dashboard ไม่ใช่ push ถึงสมาชิก) ไม่ลบแต่ database แล้วทิ้ง object
- Purge keys/queue/logs/cache/backup และ provider copies ด้วย; data model ที่ไม่มี indefinite audit retention การ restore ต้อง purge expired data ก่อนเปิด API
- Storage deletion/backup/provider retention ที่ยังพิสูจน์ไม่ได้เป็น release blocker ไม่อ้างว่า hide จาก UI เท่ากับลบสำเร็จทั้งหมด

แผน purge ล่วงหน้าเป็นข้อเสนอเพื่อทำให้ไม่เกินหนึ่งปีจริง ผู้ใช้ตรวจร่วมกับ D7 ก่อน implementation ดูข้อจำกัด external copies ใน [operations](operations.md) และ [provider comparison](slip-providers.md)

## Logical schema สำหรับ data-engineer

| Entity | Fields / constraints สำคัญ |
|---|---|
| profiles | user_id unique → auth.users; display_name; current locale |
| auth_challenges | provider; challenge/proof digest; expiry ไม่เกิน 5 นาที; consumed_at; atomic consume; ไม่มี raw ID token |
| houses | id; name; timezone; created_by |
| house_memberships | id; house_id; user_id; role; state; unique(house_id,user_id); เก็บชื่อ snapshot แยกใน history |
| house_invitations | house_id; token_digest unique; expiry; consumed_by/at; revoked_at |
| recipient_accounts | owner_user_id; bank_code; private account identifier; masked display; access เฉพาะเจ้าของ/การใช้ในบิลที่อนุญาต |
| bills | house_id; creator_id; recipient_id; total_satang; currency THB; status; due_date; version; account snapshot; created_at; expires_at; retention_deadline_at |
| bill_shares | bill_id + membership_id unique; bps; amount_satang; self_covered; snapshot name; composite house linkage |
| payment_attempts | share_id; payer_id; method; declared/verified amount; status; idempotency key; reservation; version; expiry capped to bill |
| slip_artifacts | attempt_id; uploader_id; private object path unique; hash; size/type; finalized_at; expires_at capped to bill |
| verified_transfers | normalized bank reference unique across app while retained; transaction_at; attempt_id; minimal result; expiry capped to parent |
| chore_schedules | house_id; creator_id; mode; local rule; ordered pool; anchor; revision; active flag |
| chore_occurrences | house_id; schedule_id nullable; local_date; assignee_id; task snapshot; state; completed_at; created_at; expires_at; retention_deadline_at; unique rule occurrence |
| activity_events | house_id; actor; event_type; subject; minimal payload; created_at; expiry capped to parent |
| activity_read_state | user_id + house_id unique; last_seen cursor; current state |
| maintenance_jobs | bounded metadata/object deletion/reconcile state; no raw slip/token; expire/delete on completion and within parent retention |

Cross-house foreign keys/checks และ authorization ต้องป้องกัน id ของบ้านอื่นตั้งแต่ database; ไม่พึ่งการกรอง frontend Index อย่างน้อย membership(user_id,state), bills(house_id,created_at,id), shares(bill_id), attempts(share_id,status), occurrences(house_id,local_date), events(house_id,created_at,id), expiry indexes ที่ purge ใช้

Retention อาจชน unique bank reference หลังลบประวัติ: รับธุรกรรมเฉพาะ transaction_at >= bill.created_at เสมอ เพื่อไม่ให้โอนเก่าที่ลบ dedupe แล้วนำกลับมาใช้กับบิลใหม่
