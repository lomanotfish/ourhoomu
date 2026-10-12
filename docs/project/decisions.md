# Decision log และรายการรอยืนยัน

วันที่ 2026-10-12 · Design v0.1

## ยืนยันแล้วจากผู้ใช้

- รอบนี้เอกสารและ checklist ก่อนพัฒนา
- TestFlight เป็นช่องทางแจกช่วงแรก
- Google + Apple login ผ่าน ourhoomu-api; THB; ไทยหรืออังกฤษได้
- ทุกคนสร้างบิลและเปลี่ยนผู้รับเงินได้ ผู้รับเงินออกเงินก่อนและหักส่วนตนเองอัตโนมัติ
- รองรับทยอยจ่าย โอนตรวจ API ภายนอก เงินสดผู้สร้างบิลยืนยัน
- สลิปเฉพาะผู้แนบและผู้รับเงิน
- เวรจัดเอง/ทำซ้ำ/หมุนอัตโนมัติ ผู้รับกดเสร็จ
- แจ้งเตือนเฉพาะในแอปเมื่อเปิด ไม่มี push/local notification
- ประวัติทุกอย่างไม่เกินหนึ่งปีนับจากสร้าง
- เปรียบเทียบ provider แล้ว; ผู้ใช้เลือก SlipOK ตามคำสั่ง “ใช้ slipOk แทน” เมื่อ 2026-10-12 ยังไม่ได้ซื้อหรือเชื่อม API จริง
- เลือก Neon database; อนุญาต CLI/skills/MCP/link โปรเจกต์ lucky-bar-14515304 branch production, config private slip bucket และ neon deploy ตาม SW-0015

## ข้อเสนอของ Tech Lead สำหรับตรวจแบบ

| ID | ข้อเสนอและเหตุผล |
|---|---|
| D1 | Neon PostgreSQL และ private slip bucket ยืนยันตาม ADR-0002; Expo/React Native ยังเป็นข้อเสนอ API runtime/hosting และ identity provider รอตรึงแบบใหม่ |
| D2 | UI ไทย, timezone บ้านเริ่ม Asia/Bangkok; เก็บเวลาระบบเป็น UTC และวันเวรเป็นวันที่ท้องถิ่น |
| D3 | owner บ้านจัดการชื่อ/สมาชิก/คำเชิญ; สมาชิกทุกคนสร้างบิลและตารางเวรได้ ผู้สร้างจัดการรายการของตน; owner จัดการเวรได้ แต่ไม่มีสิทธิ์ดูสลิปเพิ่ม |
| D4 | เชิญผ่านลิงก์หรือรหัสแบบใช้ครั้งเดียว อายุ 7 วัน แชร์เองได้ ไม่ส่งอีเมลจากระบบ; owner ยกเลิกได้ |
| D5 | ทำซ้ำรายวันหรือรายสัปดาห์/เลือกวัน; หมุนหนึ่งคนต่อ occurrence ตามลำดับสมาชิกที่กำหนด แสดง preview ก่อนบันทึก |
| D6 | เงินใช้ integer สตางค์ เปอร์เซ็นต์ใช้ basis points; largest remainder ให้ยอดรวมตรง ดู domain |
| D7 | อายุประวัติใช้ 365 วันจาก created_at เป็นขีดสูงสุด เริ่มปิดการเข้าถึงและลบก่อน deadline 24 ชั่วโมงเพื่อเผื่อ retry; child ต้องไม่อยู่เกิน parent; ข้อมูลบัญชี/บ้านที่ยังใช้งานเป็น current state ไม่ใช่ประวัติหมดอายุ |
| D8 | บิลเผยแพร่แล้วตรึงยอด/ผู้หาร/ผู้รับ/บัญชีรับเงิน; ยกเลิกได้ก่อนมีเงินยืนยันเท่านั้น ไม่แก้ยอดย้อนหลัง |
| D9 | สลิปหนึ่งธุรกรรมต่อหนึ่งงวด ไม่แบ่งสลิปเดียวคร่อมหลายบิล; เงินโอนที่ตรวจไม่ได้คง pending/needs_attention ไม่มี manual approve แทน |
| D10 | all domain reads/writes และ slip downloads ผ่าน API; native login consent และ signed file upload เป็นขั้นตอนนอก API ที่จำเป็น; download ตรวจ membership สดทุก request |
| D11 | ไม่เพิ่มหน้าจอ manual account linking ใน MVP เป็นข้อเสนอ; identity/session provider และ linking policy ต้องกำหนดใหม่สำหรับ Neon ไม่อ้าง Supabase auto-linking เดิมเป็นพฤติกรรมที่ใช้อยู่ และไม่รวมบัญชีจาก display name |
| D12 | เมื่อเปิด/กลับเข้า foreground/กด refresh ดึงข้อมูลล่าสุด; offline อ่าน cache ที่ไม่หมดอายุได้ แต่การจ่าย/ยืนยัน/ทำเวรต้องออนไลน์ |

## การตัดสินใจที่ยังค้าง

| เรื่อง | Owner / next action | ขวางอะไร |
|---|---|---|
| อนุมัติ design v0.1 รวม D1–D12 หรือระบุข้อแก้ | ผู้ใช้ผ่าน Tech Lead หลังอ่านเอกสาร | เริ่ม implementation ทุก ticket |
| SlipOK credentials/แพ็กเกจและงบ | เลือก SlipOK แล้ว; ผู้ใช้เตรียม key/branch ID ใน secret store และยืนยันงบก่อนซื้อ; Tech Lead ตรวจ multi-recipient matching | ต่อ API จริง/ซื้อแพ็กเกจ ไม่ขวางการส่งเอกสาร |
| ผู้ให้บริการเก็บข้อมูล/ลบก่อนครบ 365 วันได้จริงหรือไม่ | Tech Lead/platform ตรวจข้อกำหนดและหลักฐานจาก provider ที่เลือก โดยไม่ส่งข้อความภายนอกจนได้รับคำสั่ง | เปิดใช้สลิปจริง; ไม่อ้างว่าสอดคล้อง retention แล้ว |
| หากผู้สร้างบิลยืนยันเงินสดของตนเอง เมื่อผู้รับเงินเป็นคนอื่น | ข้อเสนอ: อนุญาตตามกติกาผู้สร้างยืนยันของผู้ใช้ พร้อม audit และผู้รับเห็นสถานะ; ผู้ใช้แก้ได้ในการ review | ต้องยืนยันก่อนพัฒนา flow เงินสด |
| API hosting/Google-Apple session integration หลังเลือก Neon | Tech Lead ตรวจ Neon Auth ที่เปิดอยู่แล้ว เสนอ contract/ต้นทุนก่อนพัฒนา; setup นี้ยังไม่มี native login/API integration proof | SW-0003–SW-0005 และการเชื่อม API จริง |
| มี Apple Developer / Expo / Google OAuth credentials พร้อมหรือยัง | ผู้ใช้จัดเตรียมใน secret store ตอน release; Neon CLI login/setup สำเร็จแล้ว ไม่ใส่ keys ในเอกสาร | ทดสอบ social login จริงและ TestFlight |

ผู้ใช้ยืนยันแบบหลังอ่านแล้ว ให้ Tech Lead ลงวัน/ข้อความยืนยันและ revision ที่อนุมัติที่นี่ ปรับ requirement/criteria ที่ได้รับผล ก่อนเปลี่ยน ticket จาก draft เป็น ready
