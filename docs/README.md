# เอกสาร OurHoomu

เอกสารเขียนเมื่อ 2026-10-12 เป็น design v0.1 ที่รอผู้ใช้ตรวจฉบับเต็ม **การยืนยันขอบเขตจัดทำเอกสารยังไม่ใช่การอนุมัติให้เขียนแอพ**

| ต้องการทราบ | เอกสาร |
|---|---|
| ผู้ใช้ยืนยันอะไร / acceptance | [Requirement brief](team/requirements.md) |
| Stack และขอบเขตระบบ | [Architecture](project/architecture.md) |
| การหารเงิน งวด เวร และ retention | [Domain และ data model](project/domain.md) |
| หน้าจอและ flow | [UX](project/ux.md) |
| Frontend/backend เชื่อมกันอย่างไร | [API contract v0.1](project/api-contract.md) |
| API ตรวจสลิปที่เปรียบเทียบ | [Slip providers](project/slip-providers.md) |
| Hosting, ค่าใช้จ่าย, backup, release | [Operations](project/operations.md) |
| สิ่งที่ยืนยันแล้ว / ข้อเสนอ / เรื่องรอเลือก | [Decision log](project/decisions.md) |
| เหตุผลเลือก stack | [ADR-0001](adr/0001-stack.md) |
| Agent ต้องเริ่มและส่งมอบอย่างไร | [Agent guide](team/agent-guide.md) |
| งานที่จะทำและ dependencies | [Ticket board](team/board.md) |
| ความคืบหน้าสำหรับผู้ใช้ | [Checklist](../checklist.md) |

Requirement เป็นแหล่งจริงของพฤติกรรมที่ผู้ใช้ยืนยัน Domain/API/UX เป็นข้อเสนอรายละเอียดของ Tech Lead จนกว่าจะยืนยัน design v0.1 การเปลี่ยน requirement ต้องผ่านผู้ใช้และบันทึกใน decision log ก่อนเปลี่ยน acceptance
