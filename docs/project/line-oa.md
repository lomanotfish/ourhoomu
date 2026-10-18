# LINE OA — แจ้งเมื่อยืนยันการจ่ายเงิน

วันที่ 2026-10-12 · Design addition · ยังไม่มี integration หรือข้อความที่ส่งจริง

## ผู้ใช้ยืนยันแล้ว

เพิ่ม LINE Official Account ผ่าน Messaging API สำหรับ push message เมื่อยืนยันการจ่ายเงิน เป็นข้อยกเว้นใหม่จากข้อกำหนดเดิมที่แจ้งเฉพาะในแอป ผู้ใช้จะจัดเตรียม Channel ID, Channel secret และ Channel access token (long-lived) ภายหลัง ไม่เพิ่ม APNs/Expo Push หรือ local notifications ในแอพ iOS

## รายละเอียดที่รอยืนยัน

- ผู้รับข้อความ: รอคำตอบผู้ใช้ว่าจะส่งถึงผู้จ่าย/ผู้รับเงินแบบส่วนตัว หรือกลุ่ม LINE ของบ้าน ห้ามส่งไปทุกคนหรือกลุ่มที่เดาจากชื่อ
- ข้อเสนอ Tech Lead: ครอบคลุมแต่ละงวดที่เปลี่ยนเป็น confirmed ทั้ง SlipOK ตรวจผ่านและเงินสดที่ผู้สร้างบิลยืนยัน ไม่ส่งเมื่อแค่อัปโหลดสลิป, pending, rejected หรือ recipient self-covered ตอนสร้างบิล
- ข้อความตัวอย่างและการเปิดเผยข้อมูลให้สมาชิกกลุ่ม ต้องตรึงหลังยืนยันผู้รับ ข้อเสนอขั้นต่ำ: แจ้งยืนยันแล้ว + ยอดงวด THB + ยอดคงเหลือ + ลิงก์เปิดรายการในแอป; ไม่ส่งภาพสลิป, เลขบัญชี, raw provider response หรือ secret
- ข้อกำหนดเก็บประวัติหนึ่งปียังอยู่: สำเนาข้อความใน LINE/อุปกรณ์ผู้รับไม่ได้อยู่ในการควบคุม purge ของ OurHoomu ต้องตกลงขอบเขตสำเนาภายนอกก่อนส่งข้อมูลเงินจริง ห้ามอ้างว่า backend purge ลบแชท LINE ได้

## Credentials และการระบุปลายทาง

เก็บ `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` ใน secret store ของ backend เท่านั้น ไม่ใส่ใน Git, mobile build, response หรือ logs ผู้ใช้ตั้งค่าภายหลัง; ขณะยังไม่มีให้แสดงสถานะ integration unavailable ไม่ขัดขวางการยืนยันยอดเงิน

Credentials ของ channel ไม่ได้ระบุปลายทาง ต้องมี `userId` หรือ `groupId`/`roomId` ที่ตรวจสอบจาก LINE webhook ด้วย การเพิ่มเพื่อนอย่างเดียวไม่เชื่อม LINE กับบัญชี OurHoomu โดยอัตโนมัติ

ก่อน implementation ต้องตรึง binding flow ตามผู้รับที่เลือก: ส่วนตัวใช้ authenticated one-time linking challenge และพิสูจน์เจ้าของ LINE; กลุ่มต้องพิสูจน์ owner บ้านและสิทธิ์ผูกกลุ่ม ไม่รับ arbitrary destination ID จาก client เป็น authority รองรับ revoke/unfollow/leave และตรวจ binding/สมาชิกสดอีกครั้งก่อนส่ง

Webhook เป็น HTTPS public route แยกจาก app session ใช้ Channel secret ตรวจ `x-line-signature` จาก raw request body ด้วย HMAC-SHA256 ก่อน parse/process และ deduplicate redelivery ด้วย webhook event ID ไม่เชื่อ display name หรือ JSON ที่ไม่มี signature

## การส่งและความถูกต้องของยอด

1. ใน transaction ที่ finalize payment เป็น confirmed ให้บันทึก domain event และ durable outbox แบบ atomic ด้วย ไม่เรียก LINE ระหว่าง transaction
2. Unique business key ต่อ payment confirmation event + destination ป้องกันการ enqueue ซ้ำจาก verify/cash/reconcile/concurrent retries รวมงวดทยอยจ่าย
3. Worker ส่ง HTTPS `POST https://api.line.me/v2/bot/message/push` โดย Bearer channel access token ไม่ส่ง secret นี้ให้ SlipOK หรือ frontend
4. ใช้ `X-Line-Retry-Key` เดิมต่อ delivery ตั้งแต่ครั้งแรก; retry เฉพาะข้อผิดพลาดที่เหมาะสม ใช้ backoff/jitter และเพดาน attempts/quota LINE เก็บ retry key 24 ชั่วโมง จึงหยุด blind retry ก่อนพ้นหน้าต่างนี้ หากผลยัง unknown ส่งเข้า needs_attention ไม่สร้าง key ใหม่อัตโนมัติเพื่อเลี่ยงส่งซ้ำ
5. LINE API accepted ไม่รับรองว่าผู้ใช้เห็นหรืออ่านแล้ว เก็บ queued/accepted/failed/unknown/skipped ตามหลักฐาน ห้ามแสดง delivered/read โดยไม่มีหลักฐาน และไม่รับประกัน exactly-once end-to-end
6. LINE ล่ม/token หมดอายุ/โควตาหมด/ผู้ใช้ block OA ไม่ย้อน confirmed payment หรือหักยอดใหม่ รายการจ่ายและกิจกรรมในแอปยังเป็นแหล่งจริง
7. ตรวจ expiry/binding/สิทธิ์ก่อน retry; outbox/delivery metadata ใช้ expiry ไม่เกิน parent bill ตาม retention ลบ payload/PII ที่หมดอายุ ไม่ replay การแจ้งย้อนหลังหลัง restore หรือเปิด credentials ใหม่โดยอัตโนมัติ

การแจ้งบนอุปกรณ์ขึ้นกับการตั้งค่า LINE ของผู้รับด้วย ต้องตรวจแผน/โควตาข้อความ OA ปัจจุบัน ไม่รับรองว่าฟรีไม่จำกัดและไม่ซื้อแพ็กเกจเอง

## Verification ก่อนเปิดใช้จริง — SW-0018

ครอบคลุมเงินโอน/เงินสด/ทยอยจ่าย, ไม่ส่ง pending/rejected/self-covered, concurrent/replayed confirmation, timeout/429/5xx/invalid token/quota/unfollow, forged webhook/link/replayed event, revoke membership ระหว่าง queued และส่ง, unknown ก่อน/หลัง 24 ชั่วโมง, expiry/restore suppression และข้อความไม่มีสลิปหรือข้อมูลบัญชี ต้องแยก fixture tests จากการส่งจริงไปปลายทางทดสอบที่ผู้ใช้อนุญาต

## Sources

ตรวจเอกสารทางการเมื่อ 2026-10-12: [Push API reference](https://developers.line.biz/en/reference/messaging-api/#send-push-message), [Webhook](https://developers.line.biz/en/docs/messaging-api/receiving-messages/), [Retry keys และหน้าต่าง 24 ชั่วโมง](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/)
