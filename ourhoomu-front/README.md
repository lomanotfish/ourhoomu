# OurHoomu frontend

React Native + Expo Router app สำหรับ iOS และ web preview. ตอนนี้เปิด **บ้านตัวอย่างในเครื่อง** ได้ มีภาพรวม บิล เวร บ้านและสมาชิก พร้อม animation แบบลดการเคลื่อนไหวได้ ข้อมูลตัวอย่างเริ่มใหม่เมื่อรีโหลด/ปิดแอป และไม่แตะ Neon, API, บัญชีธนาคาร, SlipOK หรือ LINE

## เวอร์ชันที่ตรวจแล้ว (2026-10-12)

| Tool / package | Version |
|---|---|
| Node.js LTS บนเครื่องที่ตรวจ | 24.15.0 |
| Bun | 1.4.3 |
| Expo SDK | 57.0.28 |
| Expo Router | 57.0.26 |
| React / React DOM | 19.2.3 |
| React Native / React Native Web | 0.86.3 / 0.21.4 |
| TypeScript | 6.0.3 |

เลือก Expo SDK 57 stable จาก [Expo SDK matrix](https://docs.expo.dev/versions/latest/) และ npm `latest` ณ วันที่ข้างต้น ใช้ `bun expo install` เลือกเวอร์ชัน native modules ที่ Expo รองรับ และ `bun expo install --check` ยืนยัน dependency compatibility. Node.js ยังจำเป็นตาม [Expo Bun guide](https://docs.expo.dev/guides/using-bun/). ฟอนต์ `assets/fonts/NotoSansThai.ttf` bundle สำหรับใช้งาน offline ภายใต้ [SIL Open Font License](assets/fonts/OFL.txt).

## รันในโฟลเดอร์นี้

```sh
cd ourhoomu-front
bun install --frozen-lockfile
bun run start          # Expo dev server; กด i สำหรับ iOS Simulator หรือ w สำหรับ web
bun run ios            # ต้องมี Xcode และ iOS Simulator
bun run web            # web preview
bun run typecheck
bun run test           # invariant ของเงินตัวอย่าง
bun run format:check   # Prettier check
bun expo install --check
bun run export:web     # สร้าง dist/ สำหรับ browser
bun run export:ios     # ตรวจ/ส่งออก iOS JavaScript bundle ไม่ใช่ native build
```

`bun.lock` อยู่ในแพ็กเกจนี้เท่านั้น Root `package.json`/`package-lock.json` ยังคงเป็นของ Neon tooling และไม่ต้องรัน `npm install` ที่ root สำหรับ frontend. `node_modules/`, `.expo/`, `dist/` และไฟล์ชนิดที่ Expo สร้าง `expo-env.d.ts` ถูก ignore.

## ลอง flow

1. กด **ลองบ้านตัวอย่าง** ที่หน้าเริ่มต้น. Google/Apple ยังไม่เชื่อม จึงไม่มีปุ่มเข้าสู่ระบบที่แสร้งว่าสำเร็จ.
2. ภาพรวมแสดงยอดค้าง ยอดรอรับ เวรวันนี้ และกิจกรรม. หัวบ้านสลับบ้านได้; หน้า **บ้าน** มีสมาชิก สร้างบ้านใหม่ และเข้าร่วมด้วยรหัสตัวอย่าง `MINT`.
3. สร้างบิลโดยเลือกผู้รับเงิน ผู้หาร และหารเท่ากันหรือกำหนดเปอร์เซ็นต์. พรีวิวคิดเงินเป็นจำนวนเต็มสตางค์/เปอร์เซ็นต์ bps และแจกเศษแบบ largest remainder. ส่วนของผู้รับเงินนับออกเองเฉพาะเมื่อเป็นผู้หาร. ลองยอด ฿200.00 หาร 50/50 และเลือกอีกคนเป็นผู้รับเงิน.
4. ในรายละเอียดบิล แจ้งจ่าย ฿40.00 แบบเงินสดหรือโอนตัวอย่าง. สถานะจะรอ และยอดค้างเดิมไม่ลด; คำขอจะกันวงเงินอีก ฿40.00 ไว้. ถอนคำขอที่รออยู่ได้. ไม่มีการยืนยันเงินหรือส่งสลิปจริง.
5. หน้า **เวร** เลือกวันนี้/สัปดาห์/วันที่, ทำเวรของมิวให้เสร็จ, แล้วดูกิจกรรมที่เปลี่ยน. สร้างงานครั้งเดียว ทำซ้ำ หรือหมุนเวียน พร้อมพรีวิว 14 วัน.

Google/Apple session, recipient accounts, invitation tokens, payment confirmation, private slip upload/view, notifications, LINE OA และการลบข้อมูลจริงรอ API/native integration tickets. แอพเดโมไม่ขอ notification permission และไม่เรียก production network. `export:ios` พิสูจน์เฉพาะ bundle; ยังต้องทดสอบ Xcode/iPhone, OAuth, API และ TestFlight ภายหลัง.
