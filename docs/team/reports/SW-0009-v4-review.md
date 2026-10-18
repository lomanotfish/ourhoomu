# Independent frontend API/session composition review

Reviewed uncommitted candidate based on local3e7c598 by native Code Reviewer on 2026-10-16. Verdict: changes_requested. Source snapshot api-session.ts SHA256717c3a829adfd9e391f1ca507afd4ef8895cebf31d5751daca97e1b8a426e7e0; runtime/api-mode.tsx037f7adca306f3835ed56ace50a6474e449e1d1c066de346f2d0be787239183d. No source edits by reviewer.

1. P1 runtime/api-mode.tsx41–56 and api-session.ts91–151: two credential authorities share storage. Delayed bootstrap refresh can save credentials after logout; direct accept bypasses transport cached token. Reproduced both scenarios. Use sole canonical SessionAuthority for refresh, replace and logout generations.
2. P1 runtime/api-mode.tsx31–38: Expo executionEnvironment storeClient check selects SecureStore only in Expo Go; native bare builds can use memory because React Native defines window. Use Platform.OS web explicitly, native always secure adapter. Installed native Constants/RN source inspected.
3. P1 app/api.tsx signOut: clearLocalSession is overridden to local-only logout; no server /v1/auth/logout. Reproduction confirms absent request. Wire remote revocation plus guaranteed local cleanup and logout precedence.
4. P2 api-session.ts97–112: expired bootstrap invents a new refresh idempotency key per retry, bypassing existing single-flight uncertain-replay safeguards. Lost-response reproduction sent key1 then key2 and cleared credentials. Reuse canonical authority refresh policy and stable exact replay key/body within window.
5. P2 runtime cache clear only increments unexposed state; authenticated screen effects keep same runtime identity and stale profile/houses. Central auth/cache revision must clear data and cancel/ignore old requests. Mutation401 must clear signed-in state; house403/404/410 must clear unavailable selection and reload authorized houses.

Reviewer focused command: bun test ./src/session/api-session.test.ts ./src/session/authority.test.ts ./src/session/secure-credentials.test.ts — 69 pass/0fail/310 assertions. Inline Bun reproductions confirmed issues1/3/4. Existing passing tests missed composition failures. No DB/provider/native/browser acceptance. Required regressions: delayed bootstrap/save vs logout, new accepted identity replacing cached token, concurrent/lost-response refresh, native/web storage, actual logout-button revoke, terminal401 screen purge, stale requests after logout/removal, signed-out rendering.

Lead stopped only the task-owned Pi continuation adapter with SIGTERM (exit143), preserved all files, then launched owner correction task ourhoomu-v4-front-core-securityfix. No reset or external operation. Corrections and independent recheck remain pending.


## Independent recheck of fe1b1ed

Verdict changes_requested. Completed-logout generation guards, accepted token replacement, native platform storage and remote logout request are corrected. Fresh focused runtime/session/authority/storage75tests330assertions pass but independent deferred/lost-response reproductions still found:

- P1 api-session.ts183–199: local invalidation waits for remote revoke; stalled request leaves credentials usable, and an old revoke finally can clear a newly accepted identity. Clear canonical state immediately and revoke captured old credentials without late clearing newer generation.
- P2 api-session.ts100–117: bootstrap still directly refreshes with fresh key, bypassing canonical single-flight/replay; lost-response retry used key1/key2 and concurrent bootstrap produced2 requests.
- P2 runtime/api-mode.tsx81–83 and app/api.tsx35–83/mutation catches: cache revision unexposed, effects not invalidated and async setters unguarded. Expose auth/cache generation and purge/ignore obsolete results; handle auth401 and house403/404/410 centrally.

Owner correction task ourhoomu-v4-front-final-corrections received these exact findings. No browser/native/DB/provider acceptance inferred. Existing root user changes remain preserved.
