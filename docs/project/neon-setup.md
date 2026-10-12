# Neon setup — ผลจริง

วันที่ 2026-10-12 · Ticket [SW-0015](../team/tickets/SW-0015.md) · [ADR-0002](../adr/0002-neon.md)

## Workspace และ remote target

คำสั่ง Neon รันใน /Users/afe/Desktop/ourhoomu ตามผู้ใช้ระบุ Project ourhoomu (`lucky-bar-14515304`), branch production (`br-shy-frog-b30wrl6l`), region aws-ap-southeast-1, PostgreSQL 18 จาก projects get จริง ไม่มี domain migrations หรือ product writes ในรอบนี้

## ขั้นตอนและผล

| ขั้นตอน | ผลที่ตรวจแล้ว |
|---|---|
| npm i -g neon@latest | ติดตั้ง CLI 8.3.5; Node บนเครื่อง v24.15.0 |
| neon login | OAuth ผ่าน browser สำเร็จ profile DEFAULT ไม่มี credentials ในเอกสาร |
| neon skills -y | ติดตั้ง 8 skills สำหรับ codex ใน .agents/skills; skills-lock.json เก็บ source/hash |
| neon mcp -y | ติดตั้ง global MCP config ให้ 9 agents ที่ตรวจพบตาม default ของคำสั่ง ไม่ได้พิสูจน์ live tool call ใน session นี้ |
| neon link --project-id lucky-bar-14515304 --branch production -y | เชื่อมถูก target; .neon และ env อยู่ local/gitignored |
| neon config init | สร้าง root npm manifests และติดตั้ง @neon/config 1.8.6 / @neon/env 1.5.3 ตาม lockfile; ไม่มี app scaffold |
| แก้ neon.ts | ตรงตัวอย่าง preview.buckets.slip access=private ของผู้ใช้ ไม่มี declarations เปิด/ปิด Auth/Functions เพิ่ม |
| neon config plan | production ตรง policy อยู่แล้ว: no changes |
| neon deploy | exit 0, no changes; pull 7 environment variables รวม Postgres/branch/storage credentials โดยไม่พิมพ์ค่า |
| neon bucket list ... --output json | พบ slip, access_level=private; created_at=2026-10-12T10:30:22Z ซึ่งมีอยู่ก่อน deploy รอบนี้ |
| neon config status --config-json | remote auth=true ที่เปิดอยู่แล้ว และ slip private; deploy นี้ไม่ปิด Auth เดิม |

config init/skills ทำส่วน local ระหว่างรอ browser authentication ส่วน link/deploy ทำหลัง login สำเร็จ คำสั่งทั้งหมดที่ผู้ใช้ขอได้รับการดำเนินการ แม้ลำดับส่วนที่ไม่ต้องใช้บัญชีสลับระหว่างรอ

## Local tooling / credentials

```sh
npm ci
neon config status --current-branch
neon config plan
neon bucket list --project-id lucky-bar-14515304 --branch production --output json
```

Root neon.ts เป็น policy ที่ user ให้ deploy แล้ว CLI 8.3.5 เตือนว่า preview.buckets เป็น GA และย้ายเป็น top-level buckets ได้ แต่ยังรองรับรูปแบบนี้ จึงไม่แก้คำขอเอง

.neon, .env*, node_modules, graft cache และ .agents เป็น local/gitignored; package manifests/config/skills lock เป็น tracked artifacts ไม่มี DATABASE_URL/storage secret ใน Git ห้ามส่งค่าตัวแปรให้ frontend หรือ logs

neon mcp -y ใช้ global config และ account-wide key ตาม default ของคำสั่งที่ผู้ใช้ระบุ จึงติดตั้งให้ antigravity, claude-code, codex, cursor, gemini-cli, github-copilot-cli, opencode, vscode, zed; credentials อยู่ user config นอก repo การติดตั้ง config ไม่ใช่หลักฐานว่า session ปัจจุบัน reload MCP แล้ว หากใช้ tools ไม่พบให้ reload agent ก่อน

## สิ่งที่ยังไม่เสร็จ

การตั้งค่านี้ไม่พิสูจน์ Google/Apple native login, API auth/house permissions, per-user slip access, tables/transactions, upload/download flow หรือ purge/backup retention แอปยังไม่มี runtime ตาม [checklist](../../checklist.md) API hosting เลือก Cloudflare Workers ตาม SW-0020 แล้ว แต่ยังต้องตรึง Auth integration และให้ผู้ใช้ตรวจแบบก่อนเริ่มพัฒนา
