# SW-0045 — focused transport acceptance recheck

Verdict: **approve the bounded transport/session module**. F1–F3 from [the previous review](SW-0045-transport-final.md) are closed; no concrete newly introduced or affected blocking defect was found. This is independent review evidence for Lead acceptance, not completed native/login/API integration.

## Frozen scope

- Reviewed frozen `45b4894` (implementation `efb9019bab10e18f7f7d64ffb1526343a61528f7`), merged into review HEAD `457e379ff7b601f44d822ab157a68554496eb83b`. Previous findings/probes: `2bc18f3faac862bee29aaa12a0198664847f2c0a`.
- Exact worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0045-transport-review`; branch `witchagorn/sw-0045-transport-review`. Writer settled/released per assignment.
- Task `task_32f8b9a79896`, Dispatch `ctx_3312893304f8`, terminal `term_4f3c2c84-60be-4460-aca6-374bed067957`; coordinator `term_3477fed4-f980-4cc6-994c-81da695c46b2`.
- Read assigned acceptance, approved core scope, accepted refresh contract, corrected SW-0044 report, previous SW-0045 reports/probes, role and runtime instructions. SW-0045 ticket is absent here and was read with `git show local:docs/team/tickets/SW-0045.md`; current assignment overrides its historical report filename. Only this report changed; source/tests/manifests/contracts/status stayed read-only.

## Closure evidence

| Finding                                                | Independent observation                                                                                                                                                                                                                                  | Durable regression / responsible guard                                                                                                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1: paused refresh save followed by logout/replacement | After releasing the save and awaiting both operations, store and authority are null after logout and B after replacement. The next `/v1/me` call raises `SessionUnavailableError` without dispatch after logout; replacement sends `Bearer synthetic-b`. | `authority.test.ts:363` covers both transitions and the next API request. `authority.ts:174` checks generation and exact flight owner before/after load and again after save, before publishing cached session.                     |
| F2: obsolete A401 erases B's uncertainty               | Held A response, replaced with B, exhausted B's two lost-response attempts, then released A401. B's next two attempts preserve `key-2,key-2,key-2,key-2` and the exact serialized B refresh body.                                                        | `authority.test.ts:417`; terminal401 at `authority.ts:161` requires generation/owner and exact attempt before clearing uncertainty. `retainAttemptIfCurrent` applies the same ownership boundary.                                   |
| F3: first fetch crosses five minutes                   | Network throw, HTTP502 and HTTP504 each advanced the clock 300001 ms inside the first fetch: **one dispatch**, null session/store, one cache-clear callback. No old-credential retry was sent.                                                           | `authority.test.ts:481` durably covers network failure. Supplemental independent gateway probes below cover 502/504. Every initial/retry dispatch passes `dispatchRefreshFetch` at `authority.ts:349`; owned expiry clears locally. |

The independent script was derived from the committed prior report's durable probes, changing obsolete failure assertions to the required null/B, retained-key/body and one-dispatch results; network/502/504 cases were added. `bun /tmp/sw0045-acceptance-probes.ts` exited 0. Closed cases are reproducible using the committed regressions above; the temporary script is not a required delivery artifact.

All original R1–R6 probes still pass: old-account and same-user-relogin late401 cannot replay; delayed credential reads/writes respect logout/replacement; stale storage snapshots cannot downgrade rotation; uncertain recovery preserves one key/body at 299999 ms and fails closed at 300001 ms; initial/replay/refresh/retry use `redirect: error` with zero requests at the Bun307 sink; all 13 extra malformed envelope/session/error fixtures reject. Independent cancellation leaves the other waiter able to complete one shared refresh, and same-family late401 returns the current token without another fetch. Existing focused tests also preserve offline denial, typed status/currentVersion/Retry-After and one authorized exact JSON/key replay.

## Affected await/state audit

- Refresh fetch/error/parse completion: retained-attempt mutations require matching generation, flight owner and compatible exact attempt; terminal401 cannot mutate another attempt. Parsed success enters the serialized queue, rechecks ownership after load/save, then publishes cached state. Successful attempt removal also checks ownership and object identity (`authority.ts:123–215`).
- Expiry/terminal clear: `clearIfCurrent` checks generation/owner before and after credential load, then synchronously invalidates generation/flight/cache/attempt before awaiting clear. No session/attempt/flight publication follows that await (`authority.ts:219–234`).
- Token and refresh reads check generation before/after load; token return checks generation again after queue settlement. A new flight is installed only after the current-generation read, and completion removes it only when `flight === activeFlight` (`authority.ts:241–304`).
- Replacement/logout publish the new generation and authoritative cache synchronously. Queued replacement checks generation after a delayed load; its awaited save does not republish cached authority, and its post-save cache callback checks replacement generation. Logout has no post-I/O session/attempt/flight mutation (`authority.ts:77–85`, `306–334`).

No source mutation experiment was performed because source/tests are explicitly read-only. Review stayed within the accepted module; generic endpoint DTO validation is not demanded or claimed.

## Verification

Environment: Bun 1.4.3, TypeScript 6.0.3, Prettier 3.9.10. Existing dependencies sufficed; no installation was performed.

| Command                                                                                                                                                                                      | Actual result                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `bun test src/api/transport.test.ts src/session/authority.test.ts` in `ourhoomu-front/`                                                                                                      | 34 pass, 0 fail, 134 assertions                        |
| `bun test` in `ourhoomu-front/`                                                                                                                                                              | 41 pass, 0 fail, 165 assertions                        |
| `bun run typecheck` / `bun run format:check` in `ourhoomu-front/`                                                                                                                            | Both exit 0; all matched files formatted               |
| `bun /tmp/sw0045-acceptance-probes.ts`                                                                                                                                                       | All original, F1–F3 and preserved-behavior probes pass |
| `git diff --exit-code 7756bcc -- docs/project/openapi.yaml`                                                                                                                                  | Exit 0; accepted contract unchanged                    |
| `git diff --exit-code f7dec000 -- ourhoomu-front/src/api/dto.ts ourhoomu-front/src/api/types.ts ourhoomu-front/package.json ourhoomu-front/bun.lock package.json package-lock.json bun.lock` | Exit 0; DTOs/manifests/locks unchanged                 |
| `git diff --check`; report Prettier check                                                                                                                                                    | Pass before commit                                     |

Supplemental F3 reproduction: save the following to `/tmp/sw0045-expiry.ts` and run `bun /tmp/sw0045-expiry.ts`. All HTTP is injected and tokens are synthetic.

```ts
import { strict as assert } from "node:assert";
import { createSessionAuthority } from "/Users/afe/orca/workspaces/ourhoomu/sw-0045-transport-review/ourhoomu-front/src/session/authority";
for (const mode of ["network", 502, 504]) {
  let value = {
    accessToken: "synthetic-a",
    refreshToken: "synthetic-ra",
    userId: "550e8400-e29b-41d4-a716-446655440001",
    expiresAt: "2026-10-14T12:00:00Z",
  } as {
    accessToken: string;
    refreshToken: string;
    userId: string;
    expiresAt: string;
  } | null;
  let now = 1000,
    calls = 0,
    clears = 0;
  const authority = createSessionAuthority({
    baseUrl: "https://fixture.invalid",
    now: () => now,
    credentials: {
      load: async () => value,
      save: async (s) => {
        value = s;
      },
      clear: async () => {
        value = null;
      },
    },
    onAuthenticatedCacheClear: () => {
      clears++;
    },
    fetcher: async () => {
      calls++;
      now += 300001;
      if (mode === "network") throw new TypeError("lost");
      return new Response(null, { status: mode as number });
    },
  });
  assert.equal(await authority.refreshAfterUnauthorized("synthetic-a"), null);
  assert.equal(calls, 1);
  assert.equal(value, null);
  assert.equal(clears, 1);
  assert.equal(await authority.getAccessToken(), null);
  console.log(mode, "one dispatch; null authority/store; cache cleared");
}
```

## Limits, Graft and handoff

Native adapter redirect conformance, actual native secure-storage scheduling/failure, real provider login and actual API/session-family/database effects remain **pending explicit gates**. The real307 result is Bun-only; fixtures do not establish native behavior or backend revocation. No nested agents, user questions, secrets, DB/provider/native operations, deploy/push, integration/status edits or cleanup occurred. Lead owns acceptance, integration and resource cleanup.

**Graft: ACTIVE** in this exact worktree. `graft --version` returned 0.21.1; initial `graft ask "session transport refresh mutation attempts generation ownership" --source` refreshed two changed files and found the affected paths. `graft grep 'knownSession|uncertainAttempt|flight|save|clear' --in ourhoomu-front/src/session` found 80 hits in 16 symbols across two files. Mapped full ranges were read for the await audit; non-indexed docs/config used raw reads. Final `graft build --no-gitignore --no-ignore .` reported the exact worktree cache, 43 supported files, 229 nodes and 505 edges; `graft check .` passed, optional deep tier unbuilt. Retrieval estimates were 51,758 + 8,057 = **59,815 tokens saved across two calls**; these are Graft estimates, not measured model-token reduction. This session's supplied runtime permissions are `never`/`danger-full-access`; no independent launch-argv claim is made.
