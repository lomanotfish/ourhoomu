# ourhoomu-api

โฟลเดอร์ backend ของ OurHoomu ใน monorepo เดียวกัน ปัจจุบันมีเอกสารขอบเขตเท่านั้น

## แบบที่เสนอ

Supabase Edge Functions / Deno / TypeScript เป็น API ที่ frontend เรียกใช้ทั้งหมด ยกเว้นหน้าต่างยินยอมของ Google/Apple และการรับส่งไฟล์ด้วย signed URL ที่ API ออกให้ ใช้ Supabase Auth จัดการ identity/session, PostgreSQL เก็บ domain data และ private Storage เก็บสลิป

Backend เป็นเจ้าของการหารเงิน การยืนยันงวด การตรวจสลิปกับผู้ให้บริการภายนอก สิทธิ์สมาชิกบ้าน การสร้างเวร และ retention ผู้ใช้ต้องผ่าน API เพื่อแลก/refresh/revoke session; frontend ไม่มี service-role key หรือ provider API key

โครงสร้างที่จะสร้างหลังอนุมัติแบบ:

```text
ourhoomu-api/
  supabase/
    config.toml
    migrations/
    functions/api/
    functions/retention/
    tests/
  tests/
```

โครงสร้างนี้ยังไม่ได้ scaffold ดู [architecture](../docs/project/architecture.md), [domain](../docs/project/domain.md), [API contract](../docs/project/api-contract.md) และ [operations](../docs/project/operations.md)

การแก้ migration / RLS เป็น ownership ของ data-engineer การแก้ handlers / integrations เป็น ownership ของ backend-engineer ตาม ticket แต่ละใบ Tech Lead ตรวจรับและรวมผล
