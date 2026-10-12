# ourhoomu-front

โฟลเดอร์ frontend ของ OurHoomu สำหรับ iPhone ปัจจุบันมีเอกสารขอบเขตเท่านั้น

## Stack ที่เลือกและแบบ UI ที่เสนอ

ผู้ใช้เลือก React Native + Expo และ Bun tooling ทั้ง front/back ตาม [SW-0020](../docs/team/tickets/SW-0020.md) ใช้ Bun stable ล่าสุดที่เข้ากันสำหรับ dependencies/scripts; ยังต้องมี Node.js LTS สำหรับ Expo prerequisites ส่วนบน iPhone ใช้ Hermes ดู [Expo Bun guide](https://docs.expo.dev/guides/using-bun/)

แบบ UI ที่เสนอ: TypeScript / Expo Router, TanStack Query สำหรับ server state, React Hook Form + Zod สำหรับฟอร์ม และ Expo SecureStore สำหรับ session ใช้ development build สำหรับการเชื่อม Google/Apple จริง แล้วแจก beta ผ่าน TestFlight

UI เริ่มเป็นภาษาไทย ใช้เงินบาท ผู้ใช้อนุญาตให้ใช้ไทยหรืออังกฤษ จึงยังไม่เพิ่มระบบแปลสองภาษาใน MVP

หน้าหลัก: Google/Apple login → เลือก/สร้าง/เข้าร่วมบ้าน → ภาพรวม, บิล, เวร, สมาชิก/ตั้งค่า หากมีบ้านเดียวเข้าไปทันที การเปิดลิงก์เชิญต้องได้รับการจัดการก่อน redirect อัตโนมัติ

Frontend ใช้ ourhoomu-api สำหรับข้อมูลและ session การคำนวณตัวอย่างในฟอร์มต้องถูกยืนยันจาก backend ก่อนบันทึก ดู [UX](../docs/project/ux.md) และ [API contract](../docs/project/api-contract.md)

ยังไม่มีคำสั่ง install/start/build/test เมื่อเริ่ม scaffold ให้เลือก Expo SDK ที่เสถียรและตรวจ React Native, native sign-in libraries, Node LTS และ Bun ที่เข้ากันจริง รวม EAS lockfile detection แล้วบันทึกคำสั่งกับเวอร์ชันใน README นี้
