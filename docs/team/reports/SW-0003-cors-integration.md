# SW-0003 — CORS integration follow-up

Lead-owned bounded shared API change, 2026-10-14. Accepted core OpenAPI uses GET/POST/PATCH/DELETE, online mutations use Idempotency-Key, and frontend typed errors read Retry-After. The health-only foundation allowed GET/POST/OPTIONS and authorization/content-type, and exposed no response headers. That configuration would block the approved browser integration.

Changed only the production CORS headers in src/app.ts: allow all four contracted methods plus OPTIONS, allow Idempotency-Key with existing request headers, and expose Retry-After/X-Request-ID. Configured origin stays exact; no wildcard/cookie credential policy, handler, DB or provider change. Data writer owns separate DB files; frontend writer owns its isolated source.

TDD evidence: added two real-app response/preflight tests first. Initial edit command used an incorrect relative path and changed nothing; corrected test setup then observed3pass/2fail for missing PATCH and missing exposed Retry-After. Three header assignments resolve the failures. API full suite now8pass/0fail/26assertions; format, lint and typecheck pass. Graft exact Lead query located createApp before source; final rebuild/check refreshed changed cards. Tool estimates recorded separately, not performance claims.

Actual Wrangler/workerd on loopback18846 passed existing production health/proof404/unknown404/CORS smoke plus real OPTIONS requests with PATCH/DELETE and requested authorization/content-type/idempotency-key. Observed204, exact allowed origin, methods/header permitted, and health response exposes retry-after,x-request-id. This proves emitted runtime headers, not a browser or native end-to-end flow. Owned Wrangler PID26728 was stopped with TERM; lsof confirmed no listener. No secret bindings, DB, cloud deploy or package changes.

Integrated target local receives these exact source bytes; package checks run again after merge. Domain routes and frontend wiring remain their pending tickets. Tests live in ourhoomu-api/tests/runtime.test.ts and exercise the compiled production app.
