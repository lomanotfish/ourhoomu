# ourhoomu-api

โฟลเดอร์ backend ของ OurHoomu ใน monorepo เดียวกัน ปัจจุบันมีเอกสารขอบเขตเท่านั้น

## แบบที่เสนอ

Database ใช้ Neon PostgreSQL และ Object Storage bucket slip: private ตาม [ADR-0002](../docs/adr/0002-neon.md) Root neon.ts/package manifests เป็น infrastructure tooling ไม่ใช่ app scaffold API runtime/hosting และ Google/Apple session integration ยังรอตรึงแบบใหม่

Backend เป็นเจ้าของการหารเงิน งวด การตรวจสลิป สิทธิ์บ้าน เวร และ retention ผู้ใช้ต้องผ่าน API เพื่อแลก/refresh/revoke session; frontend ไม่มี DATABASE_URL, storage credentials หรือ provider API key การดาวน์โหลดภาพสลิปผ่าน authenticated API ที่ตรวจสมาชิกสด

โครงสร้างที่จะสร้างหลังอนุมัติแบบ:

```text
ourhoomu-api/
  src/
  migrations/
  tests/
```

โครงสร้างนี้ยังไม่ได้ scaffold ต้องตรึง API runtime และ SQL actor/transaction contract บน Neon ก่อน ไม่ใช้ Supabase CLI/service-role assumptions เดิม ดู [architecture](../docs/project/architecture.md), [domain](../docs/project/domain.md), [API contract](../docs/project/api-contract.md) และ [operations](../docs/project/operations.md)

การแก้ migration / RLS เป็น ownership ของ data-engineer การแก้ handlers / integrations เป็น ownership ของ backend-engineer ตาม ticket แต่ละใบ Tech Lead ตรวจรับและรวมผล
