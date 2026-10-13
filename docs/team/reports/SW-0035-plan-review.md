# SW-0035 — Independent backend and frontend delivery plan review

2026-10-13 · Review of frozen planning artifact · Product baseline `9e4c119` · Planning base `f223f0d1137811951aff8ebaf6f1aba4e8da6d7e` · Frozen worktree HEAD `d0fa2b3b3107e22ab1db05f0205092f75082e789` (`805037d` plan commit plus `d0fa2b3` board record) · Task `task_0dace74d0843` · Dispatch `ctx_6569b5230fc9`.

## Verdict: changes_requested

The research and delivery plan preserve the accepted R1–R18 requirements as source of truth, keep D2–D12 and operational policies explicitly pending user decision, and retain real-provider, native, retention, and production gates. The dependency graph has no cycle: SW-0036 precedes SW-0003/0004, SW-0037 follows core bill/data work and precedes slip/LINE/retention handlers, and SW-0012 waits for integrated feature work. The SW-0004/SW-0037 handoff explicitly keeps original private-slip and full data acceptance open until extensions are accepted.

One acceptance handoff must be reconciled before implementation tickets can be marked ready. It is confined to the SW-0003 acceptance text; other reviewed ownership boundaries and security/retention gates are sufficiently explicit for a post-confirmation contract-freeze stage.

## Finding

### P1 — SW-0003 still requires native startup after the plan moves it out of scope

[SW-0003 ticket](../tickets/SW-0003.md#L26) AC2 requires both an Expo development build/Simulator startup and the API's Wrangler/Neon runtime proof. But the plan narrows SW-0003 to API runtime/tooling and says native startup belongs to SW-0009/SW-0012 ([ticket proposal](../tickets/SW-0003.md#L50), [plan](../backend-plan.md#L127)). This gives the implementer two incompatible completion paths: wait for native prerequisites outside the API foundation's dependency chain, or close SW-0003 without meeting its written acceptance. That can deadlock SW-0004/API work or silently weaken acceptance. Tech Lead should split AC2 into API runtime proof owned by SW-0003 and Expo startup proof assigned to an existing native ticket (or retain the native requirement and its explicit dependency/owner), then update the SW-0003 verification list to match.

## Review coverage and residual gates

- Compared `docs/team/backend-plan.md`, SW-0022/0023/0024 research, SW-0034 frontend plan, SW-0003–0013/SW-0018 affected tickets, SW-0036/0037, board DAG, and current requirements/spec/domain/API/database/decisions against product baseline `9e4c119`.
- No circular dependency found among core-4 and extension-37. SW-0004 ticket explicitly traces its full private-slip criterion across SW-0037 and forbids treating core-only acceptance as full data/privacy completion.
- Actor authority is consistently server-derived; live membership and expiry, transaction-scoped actor context, restricted DB roles, private slip DTO/stream checks, and restore fail-closed conditions are assigned to contracts and proof gates. Pending creator self-confirm, late transfer/replay floor, identity lane, LINE destination/copy policy, and provider retention remain labeled as choices or external gates rather than implementation assumptions.
- Work ownership addresses migration/SQL single-writer, API route registry single-writer, shared FE contracts/lockfile ownership, and disjoint FE feature slices. SW-0034 identifies the remaining account/slip/confirmation surfaces to assign exact paths before dispatch.
- No application code or executable tests were run or changed; this is a documentation-plan review.

## Official-source spot check

Opened 2026-10-13: [Elysia Cloudflare Worker integration](https://elysiajs.com/integrations/cloudflare-worker) labels the adapter experimental, documents `.compile()`/Wrangler/compatibility-date requirements and lists runtime limitations; it is a moving docs page without a release-pinned package matrix, so the planned workerd/plugin smoke remains necessary. [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) is rolling platform documentation and supports treating quotas as current operational limits, not a retention SLA. [Drizzle Neon connection guide](https://orm.drizzle.team/docs/connect-neon) is rolling documentation; it supports driver-specific proof rather than inferring transaction behavior from ORM APIs. [SlipOK FAQ](https://slipok.com/faq/) opened but contains mixed FAQ content, so it does not establish the selected verification mode's retention terms; provider-specific deletion evidence remains a release gate. The cited Neon OAuth Markdown URL `https://neon.com/docs/auth/guides/setup-oauth.md` was not accessible through this review's browser tool on 2026-10-13; no conclusion about current Apple support is drawn from that failed retrieval, consistent with the research report's stated limitation.

## Graft / workspace evidence

🌱 Graft: ACTIVE — `/Users/afe/orca/workspaces/ourhoomu/sw-0035-plan-review`; `graft --version` → `0.21.1`; `graft build --no-gitignore --no-ignore` succeeded, replaying 26 supported code files and reporting 110 nodes / 293 edges. The plan, tickets, and contracts reviewed are Markdown and are not in Graft's indexed set, so raw document reads were used as the source; `graft/` is ignored by the existing `.gitignore`. This build reported no estimated token savings; no savings are claimed.
