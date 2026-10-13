# Approved core implementation — 2026-10-13

User explicitly confirmed “ยืนยันแผน” after the concrete backend plan v0.2 and request to start core on local/dev with SlipOK, LINE and release gates retained. Source plan: [backend-plan](backend-plan.md); accepted baseline b02e4719ec0319f522539d8886b65d29c7a5c613; target local.

## Confirmed scope

- Implement and check SW-0036 contract, SW-0003 API runtime, SW-0004 core schema/atomic operations, SW-0005 core session/house/accounts, SW-0006 bills/cash, SW-0008 chores/dashboard/activity and frontend SW-0009/10 sliceA/11 against actual local API/synthetic DB.
- D2–D6, D8–D10, D12, D7 365-day UTC deadline/access expiry24h earlier, creator-as-payer cash confirmation with audit, and proposed core/provider data decomposition accepted for development. Native/provider production proof remains separate. Approved plan check matrix authorizes task-relevant tests/verification.
- Lead freezes operational values from database design: MAX_SATANG900000000000; transfer reservation30min; cash reservation24h; parent-capped reservations; verify lease2min; clock tolerance120s; reconcile cooldown30s/at most8 transient retries; schedule preview14d and generation30d; invite7d; lists20/max100. Replay floor monotonic scalar/provider precision proof stays provider-extension gate.
- Isolated synthetic Neon/schema-only branch creation, migrations/seed and restricted runtime-role checks are authorized for development. Linked production and pre-existing user dev branch remain untouched. No external API deployment, push, package purchase, actual slips/LINE messages or TestFlight upload.

## Identity boundary

Neon Managed Auth remains first candidate from approved plan, but current evidence has no proven native Apple exchange. Core contract defines one OurHoomu API session/verified actor interface, independent of issuer adapter; issuer/proof configuration is explicit and fail closed. Native Google/Apple and Managed compatibility proof cannot be invented from fixtures. Freeze adapter inputs/provider claim verification, refresh rotation/revocation and no implicit email linking; live configuration credentials needed before AC1a. Do not silently switch IdP or change remote Auth settings. Lead decides any evidenced compatibility fallback and records scope; code/DB work that does not depend on live login proceeds after its own accepted contract.

## Ownership / runtime

Lead owns confirmation/contract acceptance, board/ticket/checklist and integration. SW-0036 backend engineer may write OpenAPI/transport contract proposal and report only, then data/security and FE inspect frozen artifact. Foundation/schema/features start after relevant accepted artifact, not from runtime task success alone. One writer per isolated worktree; shared registry/config/locks/schema owner as plan.

Run run_a401e29c745e; current coordinator term_3477fed4-f980-4cc6-994c-81da695c46b2, consumer generation 3 (original term_64588939-5e2c-4ec0-a5d2-a34ed614b39e). Lead worktree /Users/afe/orca/workspaces/ourhoomu/sw-0036-core-lead, branch witchagorn/sw-0036-core-lead. Root user guide diff and untracked bun.lock preserved. Graft0.21.1 exact Lead build26files110nodes293edges; ACTIVE supported code, raw fallback for docs.

## Operational clarification — 2026-10-14

Lead freezes non-history mutation idempotency locator24h from initial accept; history locators persist through capped parent access expiry. Clients informed in SW-0044: no automatic uncertain old-write replay after window; semantic uniques/version checks remain. Invitation token and refresh-family encrypted replay5min rules unchanged. Latest core transaction lock order supersedes older database design idempotency-first prose. Wire7756bcc unchanged.
