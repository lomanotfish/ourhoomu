# เอกสาร OurHoomu

เอกสารเขียนเมื่อ 2026-10-12 เป็น design v0.1 ที่รอผู้ใช้ตรวจฉบับเต็ม **การยืนยันขอบเขตจัดทำเอกสารยังไม่ใช่การอนุมัติให้เขียนแอพ**

อัปเดต: ผู้ใช้เลือก Neon และอนุญาต setup/deploy เฉพาะ SW-0015 แล้ว [ADR-0002](adr/0002-neon.md) แทนข้อเสนอ Supabase; ไม่ใช่การอนุมัติพัฒนาฟีเจอร์ทั้งหมด

| ต้องการทราบ | เอกสาร |
|---|---|
| ผู้ใช้ยืนยันอะไร / acceptance | [Requirement brief](team/requirements.md) |
| MVP spec และ capability/dependency map | [MVP spec](project/spec.md) |
| Stack และขอบเขตระบบ | [Architecture](project/architecture.md) |
| การหารเงิน งวด เวร และ retention | [Domain และ data model](project/domain.md) |
| ตาราง คอลัมน์ ERD constraints และ transaction | [Database design](project/database.md) |
| หน้าจอและ flow | [UX](project/ux.md) |
| Frontend/backend เชื่อมกันอย่างไร | [API contract v0.1](project/api-contract.md) |
| API ตรวจสลิปที่เปรียบเทียบ | [Slip providers](project/slip-providers.md) |
| LINE OA แจ้งยืนยันการจ่ายเงิน | [LINE OA design](project/line-oa.md) |
| Hosting, ค่าใช้จ่าย, backup, release | [Operations](project/operations.md) |
| สิ่งที่ยืนยันแล้ว / ข้อเสนอ / เรื่องรอเลือก | [Decision log](project/decisions.md) |
| Stack ปัจจุบัน / ข้อเสนอเก่า | [ADR-0003](adr/0003-selected-stack.md), [ADR-0001 ที่ superseded](adr/0001-stack.md) |
| Neon ที่เลือกและผลตั้งค่าจริง | [ADR-0002](adr/0002-neon.md), [Neon setup](project/neon-setup.md) |
| งานที่จะทำและ dependencies | [Ticket board](team/board.md) |
| ความคืบหน้าสำหรับผู้ใช้ | [Checklist](../checklist.md) |
| ผลตรวจแบบและการแก้ findings | [Lead resolution](team/reports/SW-0002-resolution.md), [Independent review](team/reports/SW-0002-design-review.md) |

Requirement เป็นแหล่งจริงของพฤติกรรมที่ผู้ใช้ยืนยัน Domain/API/UX เป็นข้อเสนอรายละเอียดของ Tech Lead จนกว่าจะยืนยัน design v0.1 การเปลี่ยน requirement ต้องผ่านผู้ใช้และบันทึกใน decision log ก่อนเปลี่ยน acceptance

## Frontend ที่อนุญาตล่าสุด

- ผู้ใช้อนุญาต frontend โดยตรงแล้วและไม่ต้องรอ Figma; local Expo demo รวมและตรวจรับเมื่อ 2026-10-13. API/native/TestFlight ยัง pending ตาม tickets เดิม.
- [Visual และ motion contract](project/frontend-design.md) — SW-0026
- [Frontend implementation](team/tickets/SW-0027.md) และ [independent review](team/tickets/SW-0028.md)
- [ผลตรวจ frontend หลังรวมและ cleanup](team/reports/SW-0027-integration.md), [วิธีรัน](../ourhoomu-front/README.md)

## Backend delivery planning

[Backend task plan and frontend coordination](team/backend-plan.md) · [Multi-agent research/review delivery](team/reports/SW-0033-backend-plan-delivery.md). Product implementation follows user review of the concrete plan and material decisions; no backend deployed yet.
