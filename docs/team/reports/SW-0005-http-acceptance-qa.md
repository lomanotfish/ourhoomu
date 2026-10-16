# SW-0005 core HTTP acceptance — independent QA

## Scope and tested source

Independent QA ran the API-backed Playwright acceptance suite against the
isolated checkout at `/Users/afe/orca/workspaces/ourhoomu/qa-core-http-acceptance`.
The tested source SHA is `15d6a053b6e55dd5d7bbba7dd8b3ffef451b6a0e`, a clean
merge of implementation `77b7fb6` and accepted correction `244348c`
(`git merge-base --is-ancestor 244348c HEAD` succeeds). The checkout contains
no application or automated-test edits by QA; only this report is QA-authored.

The Tech Lead granted the exclusive guarded synthetic DB window to QA and
confirmed `/Users/afe/Desktop/ourhoomu/.git/core-finish/sw-0005-http.env` as
the private HTTP bindings file. The setup used the existing mode-600 synthetic
branch environment and branch receipt. Runtime guard checks passed, including
matching both restricted app/auth URLs to the guarded synthetic target and
requiring the exact one-provider synthetic issuer configuration. No production
or provider endpoint was used.

## Commands and results

Environment: Bun `1.4.3`, Node `v24.15.0`, Playwright Test `1.64.1`.

- `bun install --frozen-lockfile` — passed in the isolated checkout; 699
  packages installed, with no manifest or lockfile changes.
- From `ourhoomu-api/`, ran `bun run test:http` with explicit
  `SYNTHETIC_DB_ENV_FILE`, `NEON_BRANCH_RECEIPT`, `CORE_HTTP_BINDINGS_FILE`,
  `ALLOW_CORE_HTTP_ACCEPTANCE=true`, `CORE_HTTP_TEST_SHA` set to the tested
  SHA, and dedicated loopback port `18765` — passed, **7/7 tests** in `12.9s`.

Coverage exercised real Elysia handlers and restricted DB roles for signed
synthetic identity and 0/1/many house routing; challenge/exchange replay and
expiry; refresh replay, rotation and family revocation; timezone, optimistic
versions and idempotency; invitation/member lifecycle and privacy; encrypted
recipient account changes and archive; logout races against refresh/exchange.
Playwright traces, screenshots and video were disabled by the suite.

Durable redacted command output is stored outside the worktree at
`/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/http-acceptance-15d6a05.log`
(mode `600`). It contains test names and pass counts, no request/response bodies
or credentials. Playwright's generated `.last-run.json` was removed after
recording the run.

## Teardown and limits

The dedicated server exited after the suite. A follow-up `lsof` check found no
listener on `127.0.0.1:18765`; process inspection found no test server or
Playwright process. Test-worker DB pools therefore closed with the server exit.
The suite proves local HTTP handlers against the guarded synthetic DB for this
SHA. It does not prove workerd compatibility, native Google/Apple login, live
provider behavior, production operations, or TestFlight acceptance.

No test failed. No blocking issue was observed in this acceptance scope.
