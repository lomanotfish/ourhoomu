# Hosting, ค่าใช้จ่าย และ operations

ตรวจข้อมูล 2026-10-12 แผนนี้ยังไม่ provision cloud, deploy API หรือส่ง TestFlight

## เริ่มต้นและขยาย

ใช้ Supabase Free หนึ่ง project สำหรับ pilot และ local Supabase สำหรับพัฒนา; EAS Free สำหรับสร้าง beta ไม่มี web frontend hosting ที่ต้องซื้อสำหรับ native app ใช้ default Supabase domain ก่อน

Free tier ที่หน้า [Supabase pricing](https://supabase.com/pricing) ระบุ: DB 500 MB, file storage 1 GB, 50,000 MAU, Edge Functions 500,000 invocations; uncached egress 5 GB และ cached egress 5 GB; active projects ไม่เกิน 2; อาจ pause หลังไม่ใช้งานหนึ่งสัปดาห์ และไม่มี automatic backups

นี่เป็นโควตาผู้ให้บริการ ไม่ใช่การรับรองว่าการใช้งานใด ๆ จะฟรีตลอดไป ตัวอย่างคำนวณของเรา 50 สลิป/เดือน × 0.5 MB × 12 ≈ 300 MB ยังไม่รวมขนาดรูปจริง retries และ artifacts; จำกัด 5 MB ต่อไฟล์อย่างเดียวไม่พอถ้าผู้ใช้ไม่บีบรูป ตรวจ usage รายเดือนและเตือนผู้ดูแลที่ 70%/85%

Pro เริ่ม $25/เดือนตามหน้าราคา ณ วันที่ตรวจ ควรอัปเกรดเมื่อพื้นที่/egress ใกล้เต็ม ต้องการลด pause risk หรือใช้ backup/availability ที่ free ไม่ครอบคลุมก่อนเปิดกลุ่มใหญ่ ไม่ย้าย stack เพราะเกิน 10 คนโดยอัตโนมัติ

## ค่าใช้จ่ายแยกจาก hosting

| รายการ | เริ่มต้น |
|---|---|
| Supabase | $0/เดือนภายใน free quota |
| EAS Build | Free ระบุได้ถึง 15 iOS builds และ 15 Android builds/เดือน คิว priority ต่ำ; ตรวจโควตาอีกครั้งก่อน release |
| Apple Developer Program | $99/ปีสำหรับ TestFlight |
| Slip verifier | ยังรอเลือก; ตัวเลือกเริ่ม 88 หรือ 99 บาทต่อ 30 วัน มี free/trial ที่ต้องพิสูจน์เงื่อนไข |
| Domain / SMTP | ไม่มีความจำเป็นสำหรับ pilot native social-login + แชร์ invite เอง; ถ้าเพิ่มเว็บหรือ email ภายหลังประเมินใหม่ |

แหล่ง: [Expo pricing](https://expo.dev/pricing), [Apple membership](https://developer.apple.com/programs/), [Slip comparison](slip-providers.md) ราคา USD/THB แยกสกุล ไม่แปลงอัตราแลกเปลี่ยนหรือรับรองยอดรวมหลังภาษี

## Setup และ local workflow เมื่ออนุมัติพัฒนา

SW-0003 ต้องเลือกและ pin Node LTS, pnpm, Expo SDK, Deno และ Supabase CLI ตาม compatibility จริง มี Docker สำหรับ local Supabase และ Xcode/Simulator สำหรับ iOS บน Mac

API โครงสร้างเป็น ourhoomu-api/supabase/ คำสั่งอ้างอิง CLI ที่จะนำไปห่อเป็น scripts เช่น supabase --workdir ourhoomu-api start, functions serve, db reset (เฉพาะ local), db lint และ test db ต้อง validate กับเวอร์ชันที่ pin ก่อนลง README เป็นคำสั่งใช้งานจริง

Frontend ต้องมี scripts dev/ios/typecheck/test ที่ทดสอบแล้ว Google/Apple จริงใช้ development build; ไม่อ้างว่า Expo Go พิสูจน์ production login ได้ ใช้ [Supabase CLI reference](https://supabase.com/docs/reference/cli/introduction) และ [Expo setup](https://docs.expo.dev/build/setup/)

## Secrets และ environments

Dev/local ใช้ข้อมูลจำลอง ส่วน pilot มี project จริงแยก Secrets อยู่ใน environment/secrets store:
- Public app config: API base URL, OAuth client IDs ที่เผยแพร่ได้, app bundle ID
- Server-only: Supabase service credentials สำหรับงานเฉพาะ, slip key, signing/challenge secrets ถ้าจำเป็น
- Build credentials: Apple signing / App Store Connect / Google OAuth config

ไฟล์ env.example มี placeholders เท่านั้น ไม่ใส่ keys ใน repo/EXPO_PUBLIC_* หรือ worker reports ไม่ส่ง production keys ใน chat Freeze bundle ID ก่อนตั้งค่า Apple/Google Audience และ nonce ต้องตรง environment

## Database/files retention และ backup

Retention เป็นงาน server ที่ทำแม้ไม่มีใครเปิดแอป จึงต้องมี Cron แม้การแจ้งสมาชิกจะเกิดเฉพาะเปิดแอป ดูนโยบาย [domain](domain.md)

- API และ RLS มี expiry filter; signed URLs อายุสั้นและ clamp parent expiry
- Physical purge มี durable deletion job ลบ Storage ผ่าน Storage API ตามลำดับแล้วค่อยลบ metadata; retry มีขอบเขตและ monitor queue age
- เริ่มงานลบก่อนขีดหนึ่งปีตามแบบที่ตกลง เก็บ failure หลักฐานแบบไม่แนบข้อมูลส่วนตัว; ถ้า host pause/งานลบพลาดข้าม deadline ยังเป็น retention failure ไม่ถือว่าซ่อนจาก API แล้วผ่าน
- Free pause ทำให้รับรอง physical deletion SLA ไม่ได้จากราคาเพียงอย่างเดียว ก่อน pilot ต้องพิสูจน์ scheduled jobs/monitoring ที่ใช้งานจริง ถ้ารับรองไม่ได้ต้องอัปเกรดหรือกลับผู้ใช้ตัดสิน ไม่สร้าง keepalive เพื่อหลบ policy
- DB backups ไม่ได้รวม Storage objects โดยอัตโนมัติ ดู [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- ก่อนใช้ข้อมูลจริงต้องมี encrypted export/restore สำหรับ DB+files และทดสอบ restore การทำ backup ต้องไม่ยืดอายุข้อมูล: แต่ละ archive มี expiry ตามข้อมูลที่หมดอายุเร็วสุดหรือใช้วิธีลบ/cryptographic erasure ที่พิสูจน์ได้; ห้ามเก็บ backup เกิน retention เพียงเพราะอยากกู้คืน
- Restore ไป isolated environment ทำ purge ก่อนเปิด API; ไม่คืนบัญชี/permissions เก่าที่ถูกเพิกถอน
- Provider copies และ managed backups ที่ควบคุมไม่ได้ยังเป็น blocker จนมีหลักฐาน policy/deletion ไม่รับรองลบทุกสำเนาจาก design อย่างเดียว

## Logs และ monitoring

ใช้ structured logs requestId, route, error code, latency และ provider category โดยไม่ลง tokens, slip bytes, full account หรือ raw provider response Logs และ idempotency/retry metadata เป็นข้อมูลประวัติ ต้องมี expiry สั้นกว่า 365 วันและไม่ยืด parent

Operational dashboard ติดตาม API errors, verification pending age, quota, storage/DB size และ purge backlog ไม่มี notification ระบบปฏิบัติการถึงสมาชิกตาม requirement

## TestFlight และ release gate

TestFlight ไม่ต้องเก็บ UDID; external testers ใช้กลุ่ม invite เฉพาะและมี beta review Build มีอายุ 90 วัน วางรอบอัปโหลดก่อนหมดอายุ ไม่เพิ่มสมาชิกบ้านเป็น App Store Connect admin เพื่อเลี่ยง external review ดู [Apple TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)

ก่อนแจก: design/implementation ได้รับอนุมัติ, Google/Apple จริงผ่าน, cross-house/RLS/slip privacy และเงินถูกต้อง, retention/backup/provider gates ผ่าน, privacy disclosure และ account deletion พร้อม, required checks ผ่าน, เจ้าของบัญชีอนุญาตการส่ง build ภายนอก การอนุญาตทำเอกสารไม่ใช่สิทธิ์ publish/deploy

## Verification ที่ต้องสร้างใน implementation

| Risk | หลักฐานที่จำเป็น |
|---|---|
| จำนวนเงิน/งวด | unit/property cases + database transaction races/duplicate finalization |
| Tenant isolation | integration ด้วย session คนละบ้านและบทบาททุกแบบ; RLS/RPC ด้วย authenticated client |
| Native social login | development build บน iPhone จริง Google/Apple, cancel, refresh, logout/revocation |
| Provider | mock error fixtures + actual selected provider ใน sandbox/เครดิตที่ได้รับอนุญาต; แยกรายงานสองส่วน |
| เวร | date/timezone/rotation/repeat/revision/idempotent generation |
| Retention | clock-boundary tests, object+metadata deletion/retry, orphan, backup restore/provider evidence |
| UI | iPhone flow, accessibility, failure/retry, 0/1/many houses, no notifications permission |

ขณะนี้ยังไม่มี runtime tests เพราะเป็น docs-only repo Required checks รอบนี้คือ git diff --check, local Markdown paths, ownership/scope และ independent design review
