# เปรียบเทียบ API ตรวจสลิป

ตรวจแหล่งทางการเมื่อ 2026-10-12 ผู้ใช้เลือก **SlipOK** แล้วตามคำสั่ง “ใช้ slipOk แทน” ยังไม่ได้อนุมัติซื้อหรือส่งสลิปจริง ราคา/โควตาเปลี่ยนได้ ต้องตรวจแพ็กเกจ API ที่ checkout ก่อนจ่าย ไม่ใช้จำนวนสลิปผ่าน LINE มาแทนจำนวน API

## ราคาและความเหมาะสมกับ OurHoomu

| Provider | ราคาเริ่มที่พบ | โควตา/ทดลอง | ประเด็นการเชื่อม |
|---|---|---|---|
| Slip2Go | BASIC-1 88 บาท / 30 วัน | API 352 สลิป; ทดลอง 7 วัน 100 สลิป | REST ส่งรูป/QR, checkReceiver และ checkDuplicate; เหมาะเป็นผู้สมัครทดลองแรกสำหรับผู้รับเงินที่เปลี่ยนตามบิล |
| EasySlip | Start 99 บาท / 30 วัน | 250 ครั้ง; มีทดลอง 7 วันตามหน้าผู้ให้บริการ | API v2, รูป/QR/Base64/URL, amount และ recipient matching; มี async สำหรับ QR แต่ MVP ใช้ flow ง่ายก่อน |
| SlipOK | OK BASIC 0 บาท/เดือน | 100 สลิป/เดือน; หน้าเว็บระบุเกินโควตา 1 บาท/รายการ | ส่งรูป/QR/URL; amount; log=true เช็คบัญชีผูกสาขาและ duplicate ส่วน log=false ไม่เก็บรายการตามฟังก์ชันนั้นและไม่ตรวจซ้ำให้ |

แหล่งราคา: [Slip2Go](https://slip2go.com/), [EasySlip API products](https://easyslip.com/api-products/), [SlipOK packages](https://slipok.com/)

แหล่งพฤติกรรม: [Slip2Go image API](https://slip2go.com/guide/rest-api/image), [Slip2Go response/cost status](https://slip2go.com/guide/response), [EasySlip v2](https://document.easyslip.com/th/v2/), [SlipOK check-slip](https://slipok.com/api-documentation/check-slip/)

ตัวเลขเทียบเมื่อใช้เต็มโควตา: Slip2Go 88/352 = 0.25 บาท/ครั้ง; EasySlip 99/250 ≈ 0.396 บาท/ครั้ง เป็นการหารราคาแพ็กเกจ ไม่ใช่อัตราเรียก API ตามจริงทุกกรณี ถ้าใช้ 50 ครั้งต่อเดือนยังจ่ายแพ็กเกจขั้นต่ำเท่าเดิม Retry/error บางชนิดอาจกินโควตาตามผู้ให้บริการ

ตัวอย่าง budget สมมติ 10 คน × 5 งวดโอน/เดือน = 50 submissions ยังไม่รวม retry และการตรวจไม่ผ่าน โควตาต่ำสุดสองเจ้าแรกพอในสมมติฐานนี้ แต่ไม่ใช้จำนวนผู้ใช้แทน usage จริง

## ผู้ให้บริการที่เลือก

ใช้ **SlipOK** เป็น provider ของ MVP ตามผู้ใช้ แทนข้อเสนอ Slip2Go เดิม ตารางข้างต้นคงไว้เป็นประวัติเปรียบเทียบ ต้องพิสูจน์ multi-recipient matching ที่ไม่ยึดบัญชี merchant เดียว พร้อมการลบข้อมูลก่อนเปิดใช้จริง

การเลือกนี้ไม่ใช่ผล benchmark หรือการยืนยัน SLA ยังไม่มีการส่งสลิปจริง สมัครบัญชี หรือทดสอบ endpoint ด้วย credentials

### ขอบเขต adapter ที่ต้องพัฒนาใน SW-0007

- เรียก HTTPS `POST https://api.slipok.com/api/line/apikey/<BRANCH_ID>` จาก ourhoomu-api เท่านั้น เก็บ `SLIPOK_BRANCH_ID` และ `SLIPOK_API_KEY` ใน server secret store; key ส่งผ่าน `x-authorization` ไม่ฝังในแอพหรือ log
- ส่งรูปเป็น multipart `files` หรือ QR `data` อย่างใดอย่างหนึ่ง ไม่เปิด public bucket หรือแจก read URL ให้ provider; ส่ง `amount` ของงวดที่กำลังจ่าย ไม่ใช่ยอดทั้งบิล และ normalize เงินกลับเป็น integer สตางค์
- ตาม [Check Slip](https://slipok.com/api-documentation/check-slip/) `log=true` ตรวจผู้รับกับบัญชีที่ผูกสาขาและตรวจซ้ำ; `log=false` ไม่ตรวจซ้ำให้ และข้อมูลบัญชี/ชื่อในผลตอบกลับอาจถูก mask จึงไม่ถือว่า `success=true` ยืนยันผู้รับของทุกบิลได้
- ก่อนเครดิตเงินจริง ต้องพิสูจน์การตรวจผู้รับตามบัญชี snapshot ของบิลเมื่อผู้รับเป็นสมาชิกต่างคนกัน รวมกรณีชื่อ/เลขท้ายตรงกัน หากหลักฐานไม่พอให้คง pending/needs_attention ไม่เดาจากข้อมูล masked และไม่ลดเงื่อนไขความถูกต้องเพื่อใช้ provider ที่เลือก
- ป้องกัน transaction ซ้ำข้ามบิล/บ้านในฐานข้อมูลแอปเอง; การเลือกค่า `log` และการผูกสาขาต้องผ่าน recipient/retention gate ก่อนใช้จริง ไม่ตั้ง `log=false` เพื่ออ้างว่าลบข้อมูลครบแล้ว

## เงื่อนไขที่ต้องผ่านก่อนเปิดใช้จริง

1. ตรวจบัญชีผู้รับที่เปลี่ยนตามบิลได้ ตรวจทั้งธนาคารและ identifier ที่เพียงพอ ชื่อ/เลขท้ายอย่างเดียวไม่พอ ต้องทดสอบคนชื่อเหมือน/เลขท้ายเหมือน
2. คืน transaction reference ที่คงที่และวันที่โอนจริง ตรวจ duplicate ในแอปข้ามบิล/บ้านได้ โดยไม่เปิดเผยธุรกรรมของบ้านอื่น
3. แยก bank delay, timeoutunknown, invalid และ quota ออกจากกัน มีวิธี reconcile คำขอที่อาจสำเร็จแล้ว ไม่คิดค่าตรวจซ้ำไม่จำกัด
4. ทดสอบสลิปธนาคารที่กลุ่มแรกใช้จริง รูปบีบอัด สลิปซ้ำผิดบัญชีและยอดทยอยจ่าย ไม่ถือว่า marketing claims คือหลักฐานผ่าน
5. ยืนยันสิทธิ์ API ของแพ็กเกจ free/trial, VAT, การนับ error/retry, ระยะโควตา, quota cap และเงื่อนไข IP whitelist ให้เข้ากับ hosted Edge Functions
6. **Retention:** ยืนยันว่า provider ลบไฟล์/ข้อมูล/verification logs ได้ภายในอายุ parent bill ของเรา ไม่ใช่แค่ภายในหนึ่งปีหลังอัปโหลด เพราะสลิปอาจถูกส่งตอนบิลเกือบครบปีแล้ว

## Retention ที่ยังไม่ยืนยัน

[SlipOK API FAQ](https://dev.slipok.com/api/) ระบุการเก็บข้อมูลตรวจสอบระยะยาว จึงยังรับรองข้อกำหนดหนึ่งปีของ OurHoomu ไม่ได้ และ log=false ไม่ใช่หลักฐานว่าไม่มีการเก็บข้อมูลทุกชั้น

เอกสารสาธารณะที่ตรวจของ Slip2Go/EasySlip ยังไม่ให้หลักฐานเพียงพอว่าลบทุกสำเนาตาม expiry ของแต่ละบิลได้ ต้องตรวจสัญญา/นโยบาย/API deletion หรือข้อตกลงเป็นลายลักษณ์อักษรก่อนส่งข้อมูลจริง

ถ้า SlipOK ไม่ผ่าน ต้องกลับให้ผู้ใช้ตัดสินใจเรื่อง retention ของสำเนาที่ provider หรือเปลี่ยนแนวทาง ห้าม agent เปลี่ยน provider, retention หรือให้คนกดอนุมัติเงินโอนแทน API โดยไม่ขอแก้ requirement การตรวจ recipient/retention เป็น release blocker ของเงินโอน ไม่ขวางเอกสารออกแบบ

## โครงสร้างที่ไม่ผูกเจ้า

สร้าง SlipVerifier interface เดียวใน backend, adapter สำหรับเจ้าแรก และ normalized outcome ฝั่ง UI การตรวจป้องกันซ้ำ/ยอดคงเหลือ/authorization เป็นของฐานข้อมูลแอปเสมอ ไม่พึ่ง provider อย่างเดียว หลีกเลี่ยง failover ไปหลายเจ้าโดยอัตโนมัติ เพราะทำให้คิดเงินซ้ำและตีความ duplicate ยาก
