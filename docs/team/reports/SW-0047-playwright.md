# SW-0047 — Playwright acceptance evidence

Date: 2026-10-15. QA worker task `task_fcf9d980a17a`, dispatch
`ctx_77ba26d51060`, Run `run_a401e29c745e`.

## Result and scope

**24 Playwright cases pass, 0 failures, 0 skips, 0 flaky tests, no retries.**
Final run started `2026-10-15T01:19:54.513Z` and took 23.7 seconds.
20 browser cases cover 10 demo scenarios at both desktop and mobile sizes;
4 HTTP cases execute against actual local Wrangler/workerd. No app/API/schema,
DTO, root manifest, ticket, board or checklist changes were made.

Tested tree: baseline `0475b32d8eaae5b4a0eda36dcc17541616f912a6` with this
QA-only diff; branch `witchagorn/sw-0047-playwright`, worktree
`/Users/afe/orca/workspaces/ourhoomu/sw-0047-playwright`.
The dispatch explicitly superseded the ticket's older baseline `3d8d631`.
The final worker message supplies the commit containing this tested suite/report.

## Environment and sources

- macOS 26.6.2 (25G83), arm64; Node.js 24.15.0; Bun 1.4.3.
- Expo 57.0.28; Playwright Test **1.64.1**, exact package and transitive
  Playwright/core versions locked in frontend `bun.lock`.
- Chromium 156.0.8078.4, Playwright build v1248, bundled headless shell;
  no system Chrome profile. FFmpeg build1013 installed by browser setup.
- Wrangler 4.150.0 / its locked workerd runtime; API package installed with
  `bun install --frozen-lockfile`. No DB/provider credentials required or used.
- Official current registry checked using
  `curl -fsSL https://registry.npmjs.org/@playwright/test/latest`:
  version `1.64.1` on this date.
- Official [webServer lifecycle](https://playwright.dev/docs/test-webserver) and
  [APIRequestContext testing](https://playwright.dev/docs/api-testing) informed
  the server array, isolated request fixture and teardown settings.

Runtime permission evidence: executing shell's parent Codex PID49740 argv was
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`; session environment
also declares approval never / danger-full-access. No additional worker launched.

## Coverage

| Project | Cases | Observations asserted |
| --- | ---: | --- |
| desktop-chromium | 10 | 1280×900 viewport; demo entry/tabs/reload reset; equal bill 200 baht 50/50 and recipient change; custom 99.99% rejected then 40/60 shares80/120; partial cash40 pending without reducing owed100, available60, overpayment rejection and cancellation restoring100; manual/repeat/rotation schedules, ordering and week/date counts; calendar Enter/Space, month navigation, date selection and focus return; switch/create/join houses; reduced-motion identity press transform; assigned chore completion and activity |
| mobile-chromium | 10 | Same assertions at390×844, mobile/touch enabled; Asia/Bangkok timezone |
| workerd-api | 4 | Actual local health200 envelope and header/body request-ID equality/uniqueness; unknown route404 safe envelope/CORS; OPTIONS204 method/header/expose/max-age contract for allowed and hostile origins with no hostile reflection or credentials header; production entrypoint hides fixture proof route404 even with arbitrary bearer |

Browser tests use only the app's existing in-memory demo repository through UI
controls. No `page.route`, mocked API responses, fake login or skipped placeholders
are present. HTTP tests use the real `request` APIRequestContext fixture and
production source entrypoint on **local** workerd; the configured CORS origin is
`http://localhost:18047` only for this dev process.

Bun unit runner is preserved as `bun test ./src`: all existing tests live there;
this scope prevents Bun from attempting to run Playwright specs. Test-only
`tsconfig.e2e.json` separately verifies config/specs/helpers. Existing application
TypeScript config was not edited.

## Verification commands and exact outcomes

Commands run inside `ourhoomu-front/` unless noted:

| Command | Outcome |
| --- | --- |
| `bun add --dev --exact @playwright/test@1.64.1` | Installed pinned package and updated only frontend manifest/lock |
| `bun run test:e2e:install` | Initial download timed out30s and fallback DNS failed; recovery below succeeded |
| `PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=180000 bun run test:e2e:install` | Chromium, headless shell and FFmpeg downloaded successfully |
| `mv node_modules /tmp/SW-0047-node-modules-before-fresh-install` | Preserved former dependency directory, making next install fresh; deletion command was rejected by runtime policy, so no deletion used |
| `bun install --frozen-lockfile` | Fresh install578 packages,1.226s, no lock changes |
| `bun run typecheck` | Pass, no diagnostics |
| `bun run typecheck:e2e` | Pass, no diagnostics |
| `bun run format:check` | Pass, all matched files formatted, including new specs/config |
| `bun run test` | 41 pass,0 fail,165 assertions across4 files |
| `bun run test:e2e` | 24 pass,0 skipped/flaky/unexpected,23.7s; final process exit0 |
| `git diff --check` | Pass |
| `lsof -nP -iTCP:18047 -iTCP:18048 -iTCP:18049 -sTCP:LISTEN` | No listener output after final run; exit1 means no matching sockets |

Install/check logs, JSON counts, HTML report and initial failure evidence copied
outside the worktree to durable local directory:
`/Users/afe/orca/artifacts/ourhoomu/SW-0047-playwright/`.
Final artifacts are in `final/test-results/` and `final/playwright-report/`;
`first-run/` retains10 failed test screenshots/traces/context from locator tuning.
Frontend `test-results/` and `playwright-report/` remain ignored and contain the
final passing report; another run replaces them. No artifacts/state committed.

## Recovery and limits

First configuration readiness timed out120s: Expo bound `--host localhost` to
IPv6 `::1`, while readiness used127.0.0.1. Corrected QA frontend URL to localhost.
A diagnostic Bun-launched Wrangler accepted sockets but did not answer health;
stopped that owned process group and launch Wrangler with Node instead.
No runtime source changed. Diagnostic servers and all suite-owned servers stopped.

First complete run:11 pass/10 fail in54.5s. Failures were QA locator mistakes:
wrong exact invite-label text and unscoped text matching retained hidden tabs.
Corrected semantic labels and excluded aria-hidden screen ancestors for chore
text counts. Next run21/21 passed in21.8s. Added completion/activity and hidden
fixture-route coverage, then fresh install and final24/24 run above.
No product defect was established within this acceptance scope.

Reduced-motion evidence observes matchMedia and press-wrapper identity transform,
plus usable navigation; it is not a comprehensive animation/performance audit.
Mobile emulation is Chromium, not iPhone/Safari/Hermes/native accessibility proof.
This suite does not establish real API-backed UI, authenticated sessions, DB
transactions, cash confirmation/settlement, live issuer login, SlipOK, LINE,
retention/purge, production operations or TestFlight. Those original acceptance
criteria remain with their owners; future API-backed browser cases must exercise
real integrated handlers when available. Lead owns review, integration and status.

## Graft checkpoints

**Graft: ACTIVE**, CLI0.21.1, exact QA worktree path above.
`graft map` refreshed the inherited graph against this checkout and found44
indexed source files/191 symbols/510 edges initially. Used source-backed queries
for demo entry/bills/chores/houses and health/error/CORS, targeted symbol grep and
calendar skeleton; raw reads were for docs/config, new test files, or truncated
Graft source spans needing full labels. Initial orientation was repeated while
resolving compressed tool output; its savings estimates are not unique readings.

Final `graft check` initially reported7 added test/config nodes stale; then
`graft grep enterDemo --in ourhoomu-front/e2e` refreshed4 files and returned3 hits
across2 symbols. Final `graft check` exit0: wiring graph in sync,242 nodes;
meaning/deep layer not built or required. Cache remains local/ignored.
Eight retrieval outputs reported summed estimated savings414,953 tokens,
including repeated map estimates; this is Graft's counter, not measured billing
or a claim of unique savings. Both freshness checks have no savings counter.
