# Hosting, ค่าใช้จ่าย และ operations

อัปเดต 2026-10-12: Neon setup/deploy สำเร็จตาม SW-0015 ยังไม่ deploy product API หรือ TestFlight ดู [setup report](neon-setup.md) และ [ADR-0002](../adr/0002-neon.md)

## เริ่มต้นและขยาย

ใช้ Neon project ourhoomu branch production ตามผู้ใช้ระบุ ตรวจ plan/usage จริงใน Console และ [Neon pricing](https://neon.com/pricing) ก่อนรับรองค่าใช้จ่าย pilot; API hosting/Auth integration/scheduler ยังไม่เลือก จึงยังสรุปค่า hosting ทั้งระบบว่า $0 ไม่ได้

ไม่ใช้ Supabase quotas เดิมกับ Neon ตรวจ DB compute/storage, object storage/egress, history retention และ branch copies ตาม account จริงก่อนเปิด pilot

ตัวอย่าง 50 สลิป/เดือน × 0.5 MB × 12 ≈ 300 MB เป็นประมาณการไฟล์ ไม่ใช่ free quota; retries/รูปจริง/สำเนาใน branches เพิ่ม usage ได้ ให้มี monitor ที่ 70%/85% ของโควตาที่ account ใช้จริง

การอัปเกรดขึ้นกับ usage/availability/backup ที่ต้องการ ไม่เปลี่ยนแพลตฟอร์มหรือรับรองราคาเพียงเพราะผู้ใช้ไม่เกิน 10 คน

## ค่าใช้จ่ายแยกจาก hosting

| รายการ | เริ่มต้น |
|---|---|
| Neon | ตรวจ plan/usage/quotas ของ account จริง ไม่ใช้ราคา Supabase เดิม |
| EAS Build | Free ระบุได้ถึง 15 iOS builds และ 15 Android builds/เดือน คิว priority ต่ำ; ตรวจโควตาอีกครั้งก่อน release |
| Apple Developer Program | $99/ปีสำหรับ TestFlight |
| Slip verifier | ยังรอเลือก; ตัวเลือกเริ่ม 88 หรือ 99 บาทต่อ 30 วัน มี free/trial ที่ต้องพิสูจน์เงื่อนไข |
| Domain / SMTP | ไม่มีความจำเป็นสำหรับ pilot native social-login + แชร์ invite เอง; ถ้าเพิ่มเว็บหรือ email ภายหลังประเมินใหม่ |

แหล่ง: [Expo pricing](https://expo.dev/pricing), [Apple membership](https://developer.apple.com/programs/), [Slip comparison](slip-providers.md) ราคา USD/THB แยกสกุล ไม่แปลงอัตราแลกเปลี่ยนหรือรับรองยอดรวมหลังภาษี

## Setup และ local workflow เมื่ออนุมัติพัฒนา

Root มี npm manifest/lockfile สำหรับ @neon/config และ @neon/env จาก config init; npm ci ติดตั้ง tooling นี้ได้ Neon CLI ติดตั้ง global 8.3.5 ยังไม่มี app/workspace scripts ดูคำสั่งจริงใน [Neon setup](neon-setup.md)

SW-0003 ต้องตรึง Node/Expo/package manager และ API runtime ก่อน scaffold; SQL migrations อยู่ ourhoomu-api/migrations ไม่ใช้ Supabase CLI/local containers เดิม ไม่เปลี่ยน production branch เพื่อทดลอง migrations

Frontend ต้องมี scripts dev/ios/typecheck/test ที่ตรวจแล้ว Google/Apple จริงใช้ development build ไม่อ้าง Expo Go เป็น production login proof ดู [Expo setup](https://docs.expo.dev/build/setup/)

## Secrets และ environments

Dev/local ใช้ข้อมูลจำลอง ส่วน pilot มี project จริงแยก Secrets อยู่ใน environment/secrets store:
- Public app config: API base URL, OAuth client IDs ที่เผยแพร่ได้, app bundle ID
- Server-only: DATABASE_URL/Neon branch storage credentials, slip key, signing/challenge secrets ถ้าจำเป็น
- Build credentials: Apple signing / App Store Connect / Google OAuth config

ไฟล์ env.example มี placeholders เท่านั้น ไม่ใส่ keys ใน repo/EXPO_PUBLIC_* หรือ worker reports ไม่ส่ง production keys ใน chat Freeze bundle ID ก่อนตั้งค่า Apple/Google Audience และ nonce ต้องตรง environment

## Database/files retention และ backup

Retention เป็นงาน server ที่ทำแม้ไม่มีใครเปิดแอป จึงต้องมี Cron แม้การแจ้งสมาชิกจะเกิดเฉพาะเปิดแอป ดูนโยบาย [domain](domain.md)

- API และ RLS มี expiry filter; slip download เป็น authenticated stream พร้อม fresh membership check และ no-store; signed upload URLs อายุสั้นและ clamp parent expiry
- Physical purge มี durable deletion job ลบ Storage ผ่าน Storage API ตามลำดับแล้วค่อยลบ metadata; retry มีขอบเขตและ monitor queue age
- เริ่มงานลบก่อนขีดหนึ่งปีตามแบบที่ตกลง เก็บ failure หลักฐานแบบไม่แนบข้อมูลส่วนตัว; ถ้า host pause/งานลบพลาดข้าม deadline ยังเป็น retention failure ไม่ถือว่าซ่อนจาก API แล้วผ่าน
- Scheduler ยังไม่ติดตั้ง การ deploy bucket ไม่พิสูจน์ physical deletion SLA ต้องทดสอบ retry/monitoring กับ scale-to-zero และ outages ของ host จริงก่อน pilot
- ตรวจ Neon history/restore และ Object Storage branch semantics จาก provider จริง ห้ามนำสมมติฐาน backup ของ Supabase มาใช้; child branches/snapshots ที่มีสลิปต้องถูกลบภายใน parent deadline เดิมด้วย
- ก่อนใช้ข้อมูลจริงต้องมี encrypted export/restore สำหรับ DB+files และทดสอบ restore การทำ backup ต้องไม่ยืดอายุข้อมูล: แต่ละ archive มี expiry ตามข้อมูลที่หมดอายุเร็วสุดหรือใช้วิธีลบ/cryptographic erasure ที่พิสูจน์ได้; ห้ามเก็บ backup เกิน retention เพียงเพราะอยากกู้คืน
- Restore ไป isolated environment ทำ purge ก่อนเปิด API; ไม่คืนบัญชี/permissions เก่าที่ถูกเพิกถอน
- Provider copies และ managed backups ที่ควบคุมไม่ได้ยังเป็น blocker จนมีหลักฐาน policy/deletion ไม่รับรองลบทุกสำเนาจาก design อย่างเดียว

## Logs และ monitoring

ใช้ structured logs requestId, route, error code, latency และ provider category โดยไม่ลง tokens, slip bytes, full account หรือ raw provider response Logs และ idempotency/retry metadata เป็นข้อมูลประวัติ ต้องมี expiry สั้นกว่า 365 วันและไม่ยืด parent

Operational dashboard ติดตาม API errors, verification pending age, quota, storage/DB size และ purge backlog ไม่มี notification ระบบปฏิบัติการถึงสมาชิกตาม requirement

เพิ่ม LINE OA ยืนยันการจ่ายตาม [design](line-oa.md): worker ต้องทำงานได้แม้ไม่มีใครเปิดแอป ติดตาม outbox age, accepted/failed/unknown, quota และ token errors; อย่าล็อก payload/LINE ID/token เต็ม เก็บ server secrets แยกจาก mobile และ rotate/revoke ได้ Credentials/แผน OA ให้ผู้ใช้ภายหลัง ไม่รับรองว่าค่าใช้จ่ายฟรีไม่จำกัด ขอบเขต purge ของข้อความ LINE ยังต้องยืนยันก่อนส่งข้อมูลจริง

## TestFlight และ release gate

TestFlight ไม่ต้องเก็บ UDID; external testers ใช้กลุ่ม invite เฉพาะและมี beta review Build มีอายุ 90 วัน วางรอบอัปโหลดก่อนหมดอายุ ไม่เพิ่มสมาชิกบ้านเป็น App Store Connect admin เพื่อเลี่ยง external review ดู [Apple TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)

ก่อนแจก: design/implementation ได้รับอนุมัติ, Google/Apple จริงผ่าน, cross-house/RLS/slip privacy และเงินถูกต้อง, retention/backup/provider gates ผ่าน, privacy disclosure และ account deletion พร้อม, required checks ผ่าน, เจ้าของบัญชีอนุญาตการส่ง build ภายนอก การอนุญาตทำเอกสารไม่ใช่สิทธิ์ publish/deploy

ลำดับหลักฐาน: SW-0012 ให้ pre-release go/no-go จาก development build บน iPhone (AC1a และ AC2–AC7) ก่อนเริ่ม SW-0014; หลัง upload/review จึงติดตั้ง TestFlight และทำ smoke เพื่อปิด AC1b ใน SW-0014 การผ่าน pre-release QA ยังไม่ใช่การผ่าน TestFlight

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

ยังไม่มี application runtime tests รอบ Neon setup ตรวจ CLI plan/deploy/status, bucket access จาก remote, local context/env presence โดยไม่พิมพ์ secrets, lockfile install และ Git/document checks; ผล infrastructure ไม่ปิด acceptance ของแอป
