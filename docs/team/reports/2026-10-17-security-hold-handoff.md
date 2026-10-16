# Continuation checkpoint — 2026-10-17

User requests completing the approved local/dev work. Latest accepted local source is `f605605`; this checkpoint records an external execution gate, not product completion.

## Runtime gate verified

The installed engineering-orchestrator skill now requires the Orca live-worker runtime. Its policy `/Users/afe/.codex/engineering-team/policies/orca-live-workers.md` has a 2026-10-17 SECURITY_HOLD: filesystem enforcement, trusted violation attribution and whole-worker termination have not passed acceptance. It explicitly forbids bypassing via direct Pi, the old pi-task-runner or native delegation for Pi-only roles.

Actual launch attempt:

```sh
/Users/afe/.codex/engineering-team/scripts/orca-worker-launch --role backend --task-id SW-0006-bill-http-continue --spec-file /tmp/ourhoomu-bill-dto-only.json --worktree path:/Users/afe/orca/workspaces/ourhoomu/v4-domain-api
```

Exit78, failedStage SECURITY_HOLD. No Task, Dispatch or terminal was created. Existing work was not reset or discarded. No alternate runtime/model was used to bypass the hold.

## Accepted and pending state

- Local contains independently accepted core HTTP/session/house/account milestone, data/read/AAD/bill action projections and bounded frontend API client/house UI. Full product/native/provider acceptance remains open.
- Pending database slice `605389e8347d5e3450fa5772352d5b8dc4af9ebb`: payment/chore action projections and acceptance script. Offline author checks pass; independent review was interrupted by actual usage-limit response and no DB acceptance is claimed. It remains outside local.
- Pending pure bill projector `a081a5f9a0cf150b1c728d39b46eb57a6fb3487d`: 8 focused author tests, not integrated. Review must check gross remaining versus fallback subtraction of reservations, self-covered draft preview, safe integer fields and rejection of missing authoritative values before use.
- Domain worktree contains restored dispatch and adapter checkpoint; bill/payment/chore registration and actual HTTP acceptance remain unfinished. No broad503 rewrite was integrated.
- Frontend worktree retains uncommitted authenticated test entry/runtime/routes/config and tests. Prior task ended with Connection error; authenticated browser coverage has no accepted result. Signed-out smoke is separate and makes no /me requests.
- Current-state schedule expiry remains a pending user question: active schedules have no expiry in domain/schema while wire requires a string. Do not infer an answer from silence.
- Live Google/Apple/native, SlipOK, LINE, retention/restore, production and TestFlight retain their existing evidence/authorization gates.

## Fresh verification

Initial root typecheck failed because ignored Expo route types were stale and omitted the accepted /api route. Starting the installed Expo dev server on dedicated18117 regenerated only local generated artifacts; source was not weakened. Server stopped afterward.

Fresh `bunx turbo run typecheck test format:check lint --force` after generation:10successful/10total,0cached; API93tests290assertions. Frontend117tests671assertions also pass. Fresh browser results: existing demo/local-workerd suite24/24 passed in26.9s; API-mode signed-out suite2/2 passed in4.2s. These do not establish authenticated product browser acceptance. Dedicated test servers stopped and no listener remains on18047/18057. Logs are local `/tmp/ourhoomu-20261017-regenerated.log`, `/tmp/ourhoomu-20261017-e2e.log`, `/tmp/ourhoomu-20261017-api-smoke.log`.

## Preservation and next action

User changes AGENTS.md, docs/README.md, deleted docs/team/agent-guide.md and untracked node_modules 2/ remain untouched. Stale task-owned Expo server PID10111 was verified by cwd as v4-front-core/ourhoomu-front and stopped; dedicated18117 stopped. No credentials printed or production/provider operation performed.

Resume specialist execution only after the installed secure-runtime acceptance gate is satisfied. Then independently review pending605389e, finish narrow bill projector/HTTP adapters, verify actual API-backed browser flows, resolve schedule expiry, and continue the remaining approved core features. Do not mark original tickets done based on partial milestones.
