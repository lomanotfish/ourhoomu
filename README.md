# OurHoomu

แอพบริหารบ้านสำหรับ iPhone: หารค่าใช้จ่ายและทยอยจ่ายคืนคนออกเงิน จัดเวรงานบ้าน และติดตามสิ่งที่ต้องทำในแอป รองรับสมาชิกที่อยู่หลายบ้าน เริ่มต้นไม่เกิน 10 คน

**สถานะ: มี frontend Expo สำหรับลอง flow ด้วยข้อมูลตัวอย่าง และตั้งค่า Neon แล้ว; API และการเชื่อมข้อมูลจริงยังไม่พร้อม** การแจกช่วงแรกใช้ TestFlight เมื่อ native/API acceptance ผ่าน

## โครงสร้าง monorepo

- [ourhoomu-api/](ourhoomu-api/README.md): ขอบเขต backend — API, authentication, PostgreSQL, private slip storage และงานลบประวัติ
- [ourhoomu-front/](ourhoomu-front/README.md): ขอบเขต frontend — แอพ iOS ด้วย Expo / React Native
- [docs/](docs/README.md): requirement, แบบระบบ, API, UX และการเปรียบเทียบผู้ตรวจสลิป
- [checklist.md](checklist.md): ความคืบหน้าและหลักฐานตรวจรับ อัปเดตโดย Tech Lead
- [docs/team/board.md](docs/team/board.md): tickets, dependencies และ checkpoint สำหรับทำงานต่อ

Stack ที่ผู้ใช้เลือก: **React Native + Expo**, **Elysia บน Cloudflare Workers Free**, **Neon PostgreSQL + Drizzle ORM** และ **Bun สำหรับ dependencies/scripts ทั้ง front/back** ดู [MVP spec](docs/project/spec.md) และ [ADR-0003](docs/adr/0003-selected-stack.md) Neon project ourhoomu (`lucky-bar-14515304`) branch `production` มี Object Storage bucket `slip` แบบ private ตาม [neon.ts](neon.ts) API/DTO contract0.3.2 ตรึงสำหรับ core local/dev แล้ว; การพิสูจน์ Google/Apple login จริงยัง pending

เริ่มอ่าน [requirement](docs/team/requirements.md) → [MVP spec](docs/project/spec.md) → [คำตัดสินที่ยังรอ](docs/project/decisions.md) → [checklist](checklist.md)

## ค่าใช้จ่าย

ตรวจ plan/usage ของ Neon ใน Console ก่อนเปิด pilot; การ link/deploy สำเร็จไม่ได้รับรองค่าใช้จ่ายรวมเป็นศูนย์ ส่วน Apple Developer Program สำหรับ TestFlight $99/ปี และ API ตรวจสลิปเป็นต้นทุนแยก ดู [hosting](docs/project/operations.md) และ [เปรียบเทียบ API](docs/project/slip-providers.md)

## Workspace setup and checks

Use **Bun 1.4.3** and **Node.js 24.15.0**, pinned in `packageManager`,
`engines`, `.bun-version` and `.node-version`. Install once from this directory:

```sh
bun install --frozen-lockfile
bun run graph               # JSON task/dependency graph
bun run typecheck           # both apps, E2E types and shared contracts
bun run test                # local unit tests only; excludes DB fixture scripts
bun run format:check
bun run lint                # existing API Biome lint
bun run check:contracts     # frozen OpenAPI -> generated DTO reproducibility
bun run build               # web + iOS JS exports and Workers dry-run
bun run dev:front           # persistent Expo dev server
bun run dev:api             # persistent local Wrangler dev server
```

The private Bun workspaces keep app paths unchanged: `ourhoomu-front/`,
`ourhoomu-api/`, and `packages/*`. One root `bun.lock` replaces the root npm
lock and app Bun locks. `bunfig.toml` uses isolated installs to retain each
package's TypeScript version and peer dependency boundary. Root Neon config
dependencies remain available; `npm ci` and per-app installs are superseded.
`skills-lock.json` is unrelated. See [shared contracts](packages/contracts/README.md)
for the authoritative schema, generation and future shared-function boundary.

Turbo 2.11.8 is installed locally. Web and iOS output to separate
`ourhoomu-front/dist/web/` and `dist/ios/`; Workers dry-run outputs to
`ourhoomu-api/dist/worker/`. Expo exports preserve standard production dotenv
loading. Turbo hashes app `.env` and `.env.*` files (including ignored local
files), caller-provided `EXPO_PUBLIC_*` values and `NODE_ENV`. Explicit caller
values take precedence. Never put secrets in public variables or build outputs.
Executed exports clear Metro transforms to avoid reusing previous public values.
Turbo uses strict environment mode and local caching; no remote cache is configured.
Other tasks exclude ignored dotenv files, `.dev.vars`, dependencies and generated
artifacts from their default source inputs. Toolchain configuration and the
frozen schema affect cache keys.

Development, formatting writes, generation, E2E and runtime/DB/provider probes
are noncached. Ordinary `test` never runs a DB fixture or provider operation.
With the API dev server running, `bun run check:runtime` checks the local
production entry without a database (`RUNTIME_BASE_URL` can select a dedicated
local port). E2E is explicit: `bun run --cwd ourhoomu-front test:e2e:install`,
then `bun run test:e2e`; see [frontend testing](ourhoomu-front/README.md).
Neon setup and synthetic DB operations retain their existing authorization gates
and dedicated commands in [API setup](ourhoomu-api/README.md) and
[Neon setup](docs/project/neon-setup.md). No ordinary task deploys a Worker.

The [migration report](docs/team/reports/SW-0056-turborepo.md) records baseline,
verification, cache evidence, limits and rollback. iOS export proves only the
JavaScript bundle; native login, device/TestFlight and live provider acceptance
remain separate.
