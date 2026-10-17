# Remaining MVP work — approval plan

วันที่ 2026-10-17 · สถานะ: ผู้ใช้อนุมัติรอบ 1 แล้ว เริ่มตาม [SW-0065](../docs/team/tickets/SW-0065.md); รอบ 2–9 ยังเป็นแผนเสนอ

## เป้าหมายและฐานข้อมูลที่ใช้วางแผน

แบ่งงานคงเหลือเป็นรอบที่ตรวจรับได้ โดยนำส่วนประกอบที่ตรวจรับแล้วมาใช้ต่อ อ้างอิง [รายงานล่าสุด](../docs/team/reports/2026-10-16-core-continuation.md), [บอร์ด](../docs/team/board.md), [ขอบเขตที่อนุมัติ](../docs/team/core-implementation.md) และ [คำยืนยัน schedule](../docs/project/decisions.md) แผนนี้เป็นลำดับการส่งมอบ ไม่ใช่รายงานว่า source ใน worktree ที่ยังไม่รับได้รวมแล้ว

ติดตาม implementation ด้วย tickets เดิมใน docs/team/tickets/ และ checklist.md โดย Tech Lead ไม่สร้าง tracker ซ้ำใน tasks/todo.md การอนุมัติหนึ่งรอบครอบคลุมเฉพาะรอบที่ระบุ ทุกครั้งก่อน dispatch ต้องตรวจงานเดิมที่ยังค้าง กำหนด owner เดียว, exact worktree/base SHA, paths และ checks ใน ticket

## กติกาตรวจรับทุก round

- แก้และตรวจเฉพาะส่วนเกี่ยวข้อง เก็บหลักฐาน SHA/คำสั่ง/ผลจริง พร้อม independent review และตรวจหลังรวม local
- ใช้ Playwright สำหรับ browser/HTTP และ focused unit/authorization/race checks ตามความเสี่ยง ใช้ฐานจำลองแยกสำหรับการตรวจ DB ไม่ใช้ linked production branch
- แยกหลักฐาน fixture browser, HTTP ที่ใช้ handler/DB จริง, native device และ provider จริง ห้ามใช้ผล demo ปิด acceptance จริง
- คงสิทธิ์ membership และ retention เดิมทุก flow; ไม่เลื่อนงานป้องกันข้อมูลของ feature ไปไว้เฉพาะรอบท้าย
- อนุมัติรอบพัฒนาไม่รวมซื้อแพ็กเกจ ส่งข้อความจริง migration/deploy production หรือเผยแพร่ TestFlight การกระทำเหล่านี้ต้องระบุ target และได้รับ authorization ที่ตรงส่วน
- เจ้าของด้านล่างเป็นบทบาทที่เสนอ ไม่มี worker ใหม่ถูกเปิดจากการเขียนแผนนี้

## ลำดับรอบ

### รอบ 1 — บ้านและ session ผ่านหน้าจอ/API จริง

Tickets: SW-0005, SW-0009 และ acceptance ที่เกี่ยวข้องใน SW-0047

เจ้าของที่เสนอ: frontend-engineer สำหรับ browser/UI; backend-engineer สำหรับ HTTP correction แยก paths; qa-engineer ตรวจรับ

1. ตรวจและนำ browser harness/draft ที่ค้างมาใช้เฉพาะส่วนที่ผ่าน review ครอบคลุม actual screens ใน API mode ด้วย test identity ที่จำกัดใน development/test
2. ตรวจสร้างบ้าน เลือก/สลับบ้าน สมาชิก คำเชิญ และบัญชีรับเงินจากหน้าจอถึง API/isolated DB; แก้เฉพาะช่องว่างที่พบ
3. ตรวจ bootstrap/refresh/logout และ response ที่กลับช้าหลังสลับบ้านหรือออกระบบ

ขอบเขตหลัก: ourhoomu-front/src/api/, src/session/, src/repositories/, หน้าจอบ้าน, e2e/; API auth/house handlers เมื่อพบ defect ไม่เพิ่ม native/provider bypass

เกณฑ์จบ: บ้าน 0/1/หลายบ้านทำงาน; invite/บัญชีรับเงินเคารพสิทธิ์; logout/revocation ไม่คืนข้อมูลเก่า; มี authenticated browser หลักฐานและ HTTP/DB หลักฐานที่ระบุระดับการเชื่อมจริงชัดเจน ผล browser fixture อย่างเดียวไม่ปิด API-backed acceptance และยังไม่ปิด Google/Apple native acceptance

Dependency: ใช้ local HTTP และ API client/UI milestones ที่รับแล้ว ไม่เริ่ม scaffold ใหม่

### รอบ 2 — บิลและเงินสดครบ flow

Tickets: SW-0004/SW-0063 ส่วน projection, SW-0006, SW-0010 slice A

เจ้าของที่เสนอ: data-engineer → backend-engineer → frontend-engineer; independent financial/security review

1. ปิด bill/share reservation totals และ server-owned action flags; ตรวจ migration candidate เดิมก่อนใช้
2. เชื่อม draft/publish/list/detail และ cash reserve/cancel/confirm/reject กับ typed DB adapter และ route registry
3. เชื่อมหน้าบิลกับ API พร้อม retry/conflict/permission states

ขอบเขตหลัก: ourhoomu-api/src/db/, bill/payment handlers และ registry owner; ourhoomu-front หน้าบิลและ repository ที่เกี่ยวข้อง

เกณฑ์จบ: บิล 200 บาทหาร 50/50 ผู้รับเงิน self-covered 100 บาท; อีกคนยืนยันจ่าย 40 แล้วเหลือ 60; เงินสด 60 ที่รอยืนยันยังไม่ลดหนี้ และหลังผู้สร้างยืนยันเหลือ 0; คำขอซ้ำ/แข่งกันไม่เพิ่มเครดิตซ้ำ; แยกบ้านและสิทธิ์บัญชีถูกต้อง มี API/DB/browser evidence

Dependency: รอบ 1; การโอนตรวจสลิปอยู่รอบ 5

### รอบ 3 — เวร ตารางเวร และกิจกรรมครบ flow

Tickets: SW-0004/SW-0063 ส่วน chores/schedule, SW-0008, SW-0011

เจ้าของที่เสนอ: Tech Lead ตรึง contract; data-engineer → backend-engineer → frontend-engineer; qa-engineer ตรวจรับ

1. แยก schedule expiry ออกจาก history access expiry และแก้ contract/schema mismatch โดยไม่สร้าง TTL เอง คำยืนยันล่าสุดกำหนดให้เวรที่ไม่ได้ทำยังแสดงเมื่อ schedule หมดอายุ แต่วิธีกำหนดวันหมดอายุ schedule ยังต้องสรุปเป็นข้อเสนอให้ผู้ใช้ตัดสินก่อนแก้ส่วนนี้
2. ปิด projections/handlers สำหรับ manual/repeat/rotation, preview, complete/reopen และ revision; เชื่อมหน้าจอ
3. เชื่อม dashboard/activity กับข้อมูลจริง และตรวจ timezone/date/expiry

ขอบเขตหลัก: OpenAPI/shared contracts โดย owner เดียว, ourhoomu-api/src/db/ และ chore/dashboard/activity handlers; ourhoomu-front หน้าจอ/repositories เวร/home/activity

เกณฑ์จบ: สร้างเวรครบสามโหมด; rotation ไม่เปลี่ยนตามลำดับการกดเสร็จ; assignee complete/reopen ตามสิทธิ์; expired schedule ยังแสดง incomplete occurrences ภายใน history retention; สิ้นสิทธิ์หรือหมดอายุข้อมูลแล้วไม่อ่านต่อ; refresh เห็นผลจริง

Dependency: รอบ 1; ทำหลังรอบ 2 ตามลำดับที่เสนอเพื่อลดการแก้ DB/registry ร่วมกัน

### รอบ 4 — Google/Apple login บน iPhone จริง

Tickets: SW-0005, SW-0009 และ native startup acceptance

เจ้าของที่เสนอ: frontend-engineer/backend-engineer; qa-engineer ตรวจบนอุปกรณ์

งาน: เตรียม OAuth/development build configuration ใน secret store; ต่อ issuer จริงกับ session API; ตรวจ SecureStore/bootstrap/refresh/logout/revocation และเปิดแอปกลับมาใหม่

เกณฑ์จบ: Google และ Apple sign-in สำเร็จบน native build ที่ต่อ API; session ไม่รั่วข้ามบัญชีและ logout/revocation ทำงาน มี build/device/provider evidence

Dependency: รอบ 1; สามารถเลื่อนมาทำหลังรอบ 1 ได้หาก credentials และอุปกรณ์พร้อม ไม่ต้องรอรอบ 2–3 ทางเทคนิค

Gate: credentials/configuration, Apple/Expo/Google access และ test device ต้องพร้อม; ยังไม่เผยแพร่ TestFlight

### รอบ 5 — ตรวจสลิปและรูปส่วนตัว

Tickets: SW-0037 ส่วน slip, SW-0007, SW-0010 slice B

เจ้าของที่เสนอ: data-engineer → backend-engineer → frontend-engineer; security/QA ตรวจรับ

งาน: ตรึง SlipOK recipient/retention evidence และ credentials/งบ; private upload/read; verify/finalize/reconcile; UI เลือกรูปและสถานะจริง

เกณฑ์จบ: จำนวนและผู้รับตรงจึงเพิ่มเครดิต; duplicate/timeout/quota/late result ไม่เครดิตซ้ำ; รูปอ่านได้เฉพาะผู้แนบ/ผู้รับที่ยังมีสิทธิ์; ไม่มี private image disk cache; มีผล provider จริงก่อนปิด acceptance

Dependency: รอบ 2; retention/security primitives ต้องพร้อมก่อนใช้สลิปจริง การยืนยันงบและ external test target แยกจากอนุมัติเขียนโค้ด

### รอบ 6 — LINE แจ้งยืนยันการจ่าย

Tickets: SW-0037 ส่วน LINE, SW-0018

เจ้าของที่เสนอ: data-engineer → backend-engineer; security/QA ตรวจรับ

งาน: ยืนยันปลายทาง/ข้อความ/การผูกบัญชีและสำเนาข้อมูลใน LINE; webhook signature, binding/revoke, atomic outbox และ retries; ตรวจเงินจริง/โอนที่ยืนยันแล้วตามขอบเขตที่ตกลง

เกณฑ์จบ: confirmed payment enqueue ครั้งเดียว; pending/rejected ไม่แจ้ง; webhook/retry ไม่ซ้ำผิด; การส่งล้มเหลวไม่เปลี่ยนยอด; ไม่มีรูปสลิป/เลขบัญชีเต็มในข้อความ; ส่งทดสอบจริงเฉพาะปลายทางที่อนุญาต

Dependency: รอบ 2; การตรวจ flow โอนครบต้องรอบ 5, LINE credentials และผู้รับที่ยืนยัน

### รอบ 7 — Retention และ restore ทั้งระบบ

Tickets: SW-0037 ส่วน retention, SW-0013

เจ้าของที่เสนอ: data-engineer/backend-engineer/platform-engineer แยก SQL/jobs/config; independent security/QA

งาน: รวม bounded sweeper/deletion jobs/object-before-metadata/retries, ครอบคลุม child/cache/log/outbox/provider copies; restore quarantine และ replay floor

เกณฑ์จบ: ข้อมูลหมดอายุเข้าถึงไม่ได้แม้ลบไฟล์ขัดข้อง; ลบตาม deadline ที่อนุมัติ; restore ไม่คืนข้อมูลหมดอายุ/สิทธิ์ที่ถูกเพิกถอนหรือส่ง LINE ซ้ำ; ตรวจสำเนาที่ provider เก็บด้วยหลักฐานจริง ข้อจำกัดที่ยังพิสูจน์ไม่ได้ขวาง release

Dependency: privacy/expiry ตรวจในทุก feature มาก่อนแล้ว; ตรวจครบทั้งระบบหลังรอบ 3/5/6 ไม่ต้องรอรอบนี้เพื่อเริ่มป้องกันข้อมูล

### รอบ 8 — ตรวจรับ MVP อิสระ

Ticket: SW-0012

เจ้าของที่เสนอ: qa-engineer พร้อม security-engineer/code-reviewer ตามขอบเขต

งาน: freeze integrated SHA; ตรวจ acceptance ของ auth/บ้าน/บิล/สลิป/เวร/LINE/retention, races, offline/error และ accessibility; ส่ง defect กลับเจ้าของแก้และ recheck

เกณฑ์จบ: acceptance ที่เกี่ยวข้องผ่านบนสภาพแวดล้อมจริงแต่ละระดับ; ไม่มี defect ที่ขวาง release; เก็บ SHA/คำสั่ง/รายงาน/ภาพและข้อจำกัดครบ

Dependency: รอบ 1–7 และ credentials/environment evidence ของแต่ละส่วน

### รอบ 9 — เตรียมและแจก TestFlight

Ticket: SW-0014

เจ้าของที่เสนอ: platform-engineer และ qa-engineer

งาน: เตรียม signing/build metadata/privacy/release configuration; ตรวจ archive และ readiness; ขออนุมัติ publish สำหรับ build/target ที่ระบุ; ส่งขึ้นและตรวจติดตั้งหลังได้รับอนุมัติ

เกณฑ์จบ: build ที่อนุมัติถูกแจกผ่าน TestFlight และติดตั้ง/เปิดใช้งานจริงผ่านตามเกณฑ์ pilot

Dependency: รอบ 8, Apple/Expo access, deployment readiness และ explicit production/publish authorization ที่ตรง target

## ข้อเสนอสำหรับการอนุมัติครั้งแรก

อนุมัติรอบ 1 เท่านั้นก่อน ผลส่งมอบคือหน้าจอบ้าน/session ที่ตรวจผ่านกับ API และหลักฐานเชื่อมจริง ภายใน local/dev/isolated synthetic DB ตามขอบเขตเดิม จากนั้นรายงานสิ่งที่ผ่าน จุดที่ยังค้าง และเสนอรอบ 2 ให้ผู้ใช้อนุมัติ

รอบ 3 ต้องมีข้อเสนอวิธีกำหนด schedule expiry เพิ่มเติม คำตอบว่าแสดงเวรที่ไม่ได้ทำไม่ใช่การอนุมัติ retention TTL ใหม่ ไม่มีความจำเป็นต้องตัดสินเรื่องนี้เพื่อเริ่มรอบ 1
