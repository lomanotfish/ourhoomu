# SW-0045 — frozen transport/session correction recheck

Verdict: **changes_requested**. The six original probe scenarios now pass, but three required concurrency/window findings remain in the bounded module. Passing fixtures do not establish native or API integration.

## Frozen scope and authority

- Correction: `0bef56f1c272bd8f01e99a1dd1f89d2ac788cae0`; review worktree HEAD `01bb695ecdce1c430abe50c31e0c2aeda81fb189` merges it into `witchagorn/sw-0045-transport-review`. Workspace: `/Users/afe/orca/workspaces/ourhoomu/sw-0045-transport-review`. Writer settled/released per assignment; this worker made no implementation edits.
- Current Task `task_82503702ff2c`, Dispatch `ctx_eae645dff5f7`, terminal `term_97299e40-83c7-4d25-a8b7-fdbca1dd09fd`, coordinator `term_3477fed4-f980-4cc6-994c-81da695c46b2`.
- Read code-reviewer profile, Graft/runtime instructions, requirements, board, agent guide, approved core scope, API/core API contracts, SW-0044, original [SW-0045 report](SW-0045-transport-review.md), corrected [SW-0044 report](SW-0044-transport.md), accepted contract record and OpenAPI. SW-0045 ticket is absent in this frozen checkout; read with `git show local:docs/team/tickets/SW-0045.md`. The live assignment overrides its old report filename and authorizes only this final report.
- `git diff --exit-code 7756bcc -- docs/project/openapi.yaml` passed. Accepted refresh semantics at `docs/project/core-api-contract.md:24` and `docs/project/openapi.yaml:411` bind old credential/key/body to a five-minute replay window; a different key or past-window reuse revokes the family.
- Only this report is owned/changed. Source, tests, manifests, generated DTOs, contracts and status remain read-only. No nested agents, user questions, database/provider operations, secrets, production/deploy/push, merge or worktree cleanup. Permissions are evidenced by this session's supplied `never`/`danger-full-access` settings; no independent launch-argv claim is made.

## Required findings

### F1 — P1: deferred refresh save resurrects old authority after logout/account replacement

Locations: `ourhoomu-front/src/session/authority.ts:161–164`, `192–212`, `256–270`; logout state reset at `76–83`.

Hold `credentials.save(rotatedA)` after refresh has entered its serialized save operation. Invoke `logout()` or `replaceSession(B)` while that save is pending, then let the save complete and await both operations. Generation changes synchronously, but the already-running refresh save unconditionally assigns `knownSession = rotatedA` after its await. The newer queued clear/save fixes disk state but does not reassign the cached authority. `getAccessToken()` then treats the correct null/B store result as a stale snapshot and returns rotated A.

Independent output is `store=null, authority=synthetic-r` after logout and `store=synthetic-b, authority=synthetic-r` after replacement. An integrated subsequent `client.request('/v1/me')` sends `Bearer synthetic-r` in both cases. Logout therefore still permits authenticated calls, and switching accounts can continue operating as A. This is a residual R2 failure despite the new deferred replacement-save/clear tests.

Required correction: generation-check after the awaited refresh save before publishing cached session state; ensure newer logout/replacement remains authoritative in both memory and storage. Add regressions that pause **refresh's save**, invoke logout/replacement, resume it, await settlement, and assert the next token/API request uses null/B. Preserve the valid same-family rotation path.

### F2 — P1: stale old-account refresh 401 erases the new account's unresolved replay attempt

Location: `ourhoomu-front/src/session/authority.ts:143–145`; recovery state used at `87–104` and retained at `127`.

Hold account A's refresh response. Replace with B and exhaust B's two refresh transport attempts, leaving B's exact key/body retained for recovery. Release A's response as 401. Its unconditional `uncertainAttempt = null` executes before `clearIfCurrent` rejects A's obsolete generation, so it destroys B's recovery state. A later B caller creates a different key for B's already-possibly-consumed refresh credential.

Independent output for B's requests: `key-2,key-2,key-3,key-3`, with no intervening replacement/logout of B. Accepted replay semantics make that different-key reuse revoke B's family if its first attempt committed. The probe observes changed keys; server revocation is contract-defined, not a live API observation. This is a residual R4 failure across account replacement.

Required correction: scope all refresh-attempt state mutations, including terminal 401, to the matching generation/attempt; an obsolete response must not touch newer state. Add a held-A401/B-lost-response regression and require all later B retries to retain B's original key/body within the window.

### F3 — P1: an in-flight retry bypasses the five-minute replay deadline

Locations: `ourhoomu-front/src/session/authority.ts:92–102`, `120–124`, `131–140`, `288–293`.

The deadline is checked only when a later refresh flight begins. Inject the supported clock, start at 1000, and have the first fetch advance time by 300001 ms before throwing a transport error. The catch immediately invokes `retryRefreshFetch`, which sends the old credential/key/body again without checking elapsed time. Independent output: `retry beyond window 2 calls`; the second request starts after the replay window. A long request, device suspension or delayed networking can trigger this ordering. Under the accepted contract a previously committed first attempt followed by this old-credential retry revokes the family.

Required correction: check the attempt deadline immediately before **every** retry dispatch, including network and 502/504 branches, and fail closed locally when exhausted without sending another old-credential request. Add a clock-advanced-during-first-fetch regression. The later-caller expired-attempt test passes but does not cover this in-flight path. Native adapter evidence remains a separate gate; this missing JavaScript guard is independently reproducible with the module's injected clock/fetch.

## Original R1–R6 recheck and preserved behavior

| Original finding                          | Independent observed result at frozen correction                                                                                                                                         | Assessment                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| R1 old mutation late401 after replacement | One API call, original 401 retained, no replay under B; same-user logout/relogin likewise denied using captured revision                                                                 | Original scenario fixed                                  |
| R2 deferred credential I/O                | Deferred load returns null after logout; delayed replacement cannot win a later logout; reads during replacement save/logout clear wait and return B/null                                | Original scenarios fixed; F1 still requires correction   |
| R3 stale snapshot after rotation          | Delayed A storage snapshot returns rotated token, exactly one refresh                                                                                                                    | Original scenario fixed                                  |
| R4 unresolved refresh                     | Two lost responses plus later recovery at 299999 ms use one exact key/body across three calls; later caller at 300001 ms clears locally, only two calls                                  | Original scenarios fixed; F2/F3 still require correction |
| R5 redirects                              | Initial API, replay, refresh and refresh retry all specify `redirect: error`; actual Bun loopback307 yields zero sink requests                                                           | Bun/module protection passes; native conformance pending |
| R6 malformed primitives/envelopes         | 13 extra independent missing/non-string/non-UUID requestId, non-string session fields, extra session property and invalid error message/fields fixtures all reject as `ApiProtocolError` | Original required-field/primitive scenarios fixed        |

The focused suite additionally exercises invalid session UUID/date-time, closed error properties, concurrent401 convergence, exact JSON/key replay, HTTPS/explicit loopback, offline mutation rejection, typed 403/404/409/currentVersion/410/429 with Retry-After, terminal401 clear/cache callback and refresh replacement generation. Independent cancellation probe aborts one waiter while another returns the rotated token from one shared refresh; a subsequent same-family late401 returns the current token with no extra fetch. The integrated same-family delayed401 test in the required suite also passes.

Source inspection confirms no arbitrary authorization-header seam, body actor rejection, initial-origin validation, one replay maximum, and no generic DTO runtime schema validation claim. The existing test named “does not replay an unkeyed mutation or recurse after a second 401” still exercises the unkeyed branch only; source bounds replay to one. No source mutation test was done because source/tests are explicitly read-only; independent external probes provide behavioral evidence.

## Verification

Environment: Bun `1.4.3`, TypeScript `6.0.3`, Prettier `3.9.10`. Existing worktree dependencies were available, so no frozen install was needed.

| Command                                                                                                                                                                                      | Actual result                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `bun test src/api/transport.test.ts src/session/authority.test.ts` from `ourhoomu-front/`                                                                                                    | 30 pass, 0 fail, 117 assertions                                                                                       |
| `bun run typecheck` from `ourhoomu-front/`                                                                                                                                                   | Exit 0                                                                                                                |
| `bun run format:check` from `ourhoomu-front/`                                                                                                                                                | Exit 0, all matched files formatted                                                                                   |
| `bun /tmp/sw0045-final-probes.ts`                                                                                                                                                            | Repeated exit 0; all original corrected scenarios pass and all three residual defects reproduce; durable source below |
| `git diff --exit-code 7756bcc -- docs/project/openapi.yaml`                                                                                                                                  | Exit 0, accepted contract unchanged                                                                                   |
| `git diff --exit-code f7dec000 -- ourhoomu-front/src/api/dto.ts ourhoomu-front/src/api/types.ts ourhoomu-front/package.json ourhoomu-front/bun.lock package.json package-lock.json bun.lock` | Exit 0                                                                                                                |
| `git diff --check` and report formatting check                                                                                                                                               | Passed before report commit                                                                                           |

An initial version query mistakenly used root `node_modules/.bin` and returned missing executable; querying the frontend package returned the versions above. Required typecheck/format checks were run in the correct package and passed. No installation or tracked dependency changes resulted.

## Runtime limits and handoff

Native redirect enforcement, secure-storage behavior under actual native scheduling/failure, real provider login and API/session-family/database effects remain **pending** under SW-0009 and existing gates. The actual307 test is Bun-only and uses two ephemeral local listeners with synthetic credentials; all other HTTP is injected. No global native safety or completed login/API feature claim is made. Before native integration, the transport adapter must prove fail-closed redirects on each supported runtime.

Lead owns fix assignment, acceptance, integration, status/checklist and release/cleanup. Report delivery succeeds as an independent review artifact; it does **not** approve SW-0044. Correct F1–F3 and freeze a new result for focused independent recheck. The coordinator was sent an escalation describing these three defects while this worker preserved source ownership.

## Graft evidence

**Graft: ACTIVE** in this exact review worktree. `graft --version` returned `0.21.1`; initial `graft map` refreshed five changed files and reported 43 files, 179 symbols and 492 edges. `graft grep 'createApiClient|createSessionAuthority|parseRefreshSession|refreshAfterUnauthorized' --in ourhoomu-front/src` found 69 hits across four files. Full mapped source ranges were opened to inspect await/generation ordering beyond symbol locations. Docs/config/contracts use raw-file/`git show` fallback because they are not indexed source.

The exact-worktree `graft build --no-gitignore --no-ignore .` subsequently reported 43 supported files, 222 nodes and 492 edges at `<worktree>/graft`; `graft check .` passed with the wiring graph in sync and optional deep tier unbuilt. Local graph cache is ignored and uncommitted. Retrieval estimates reported by Graft: map 88,225 plus grep 10,322 = **98,547 tokens saved across two retrieval calls**; build/check report no savings. These are tool estimates, not measured model-token or runtime reduction. No copied-checkout source claim is made; explicit build confirms the assigned path.

## Durable reproduction source

Save this fenced block to `/tmp/sw0045-final-probes.ts` and run `bun /tmp/sw0045-final-probes.ts`. The imports target this frozen review worktree. Synthetic sessions use valid UUIDs and all delayed401 paths use the legitimate captured session revision. The script asserts corrected scenarios and the exact residual failures, uses no external server, and closes both loopback listeners in `finally`.

```ts
import { createSessionAuthority as authority } from "/Users/afe/orca/workspaces/ourhoomu/sw-0045-transport-review/ourhoomu-front/src/session/authority";
import { createApiClient as client } from "/Users/afe/orca/workspaces/ourhoomu/sw-0045-transport-review/ourhoomu-front/src/api/client";
import { strict as assert } from "node:assert";
const id = "550e8400-e29b-41d4-a716-446655440001";
const A = {
  accessToken: "synthetic-a",
  refreshToken: "synthetic-ra",
  userId: id,
  expiresAt: "2026-10-14T12:00:00Z",
};
const B = {
  ...A,
  accessToken: "synthetic-b",
  refreshToken: "synthetic-rb",
  userId: "550e8400-e29b-41d4-a716-446655440002",
};
const R = { ...A, accessToken: "synthetic-r", refreshToken: "synthetic-rr" };
const ok = (data: any) => Response.json({ data, requestId: id });
const unauthorized = () =>
  Response.json(
    { error: { code: "unauthenticated", message: "Synthetic" }, requestId: id },
    { status: 401 },
  );
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { resolve, promise };
};
const store = () => ({
  value: A as typeof A | null,
  async load() {
    return this.value;
  },
  async save(s: typeof A) {
    this.value = s;
  },
  async clear() {
    this.value = null;
  },
});
const baseUrl = "https://fixture.invalid";
// R1: capture original revision through integrated client, including same-user relogin.
for (const sameUser of [false, true]) {
  const s = store(),
    first = deferred<Response>(),
    started = deferred<void>();
  let calls = 0;
  const a = authority({ baseUrl, credentials: s });
  const c = client({
    baseUrl,
    session: a,
    fetcher: async () => {
      calls++;
      started.resolve();
      return first.promise;
    },
  });
  const p = c
    .request("/v1/houses", {
      method: "POST",
      body: { name: "old draft" },
      idempotencyKey: id,
    })
    .catch((e) => e);
  await started.promise;
  if (sameUser) {
    await a.logout();
    await a.replaceSession({ ...A, accessToken: "synthetic-relogin" });
  } else await a.replaceSession(B);
  first.resolve(unauthorized());
  const error = await p;
  assert.equal(calls, 1);
  assert.equal(error.name, "ApiHttpError");
  console.log(
    "R1",
    sameUser ? "same-user-relogin" : "account-replacement",
    "no replay",
  );
}
// R2 original read/replacement ordering: release storage before awaiting queued logout.
{
  const s = store(),
    loaded = deferred<typeof A | null>(),
    started = deferred<void>();
  s.load = () => {
    started.resolve();
    return loaded.promise;
  };
  const a = authority({ baseUrl, credentials: s });
  const p = a.getAccessToken();
  await started.promise;
  const logout = a.logout();
  loaded.resolve(A);
  await logout;
  assert.equal(await p, null);
  assert.equal(s.value, null);
  console.log("R2 deferred load", "null after logout");
}
{
  const s = store(),
    loaded = deferred<typeof A | null>(),
    started = deferred<void>();
  s.load = () => {
    started.resolve();
    return loaded.promise;
  };
  const a = authority({ baseUrl, credentials: s });
  const p = a.replaceSession(B);
  await started.promise;
  const logout = a.logout();
  loaded.resolve(A);
  await Promise.all([p, logout]);
  assert.equal(s.value, null);
  console.log("R2 delayed replacement then logout", "null");
}
for (const operation of ["replace", "logout"]) {
  const s = store(),
    gate = deferred<void>(),
    started = deferred<void>();
  if (operation === "replace")
    s.save = async (v) => {
      started.resolve();
      await gate.promise;
      s.value = v;
    };
  else
    s.clear = async () => {
      started.resolve();
      await gate.promise;
      s.value = null;
    };
  const a = authority({ baseUrl, credentials: s });
  const write = operation === "replace" ? a.replaceSession(B) : a.logout();
  await started.promise;
  const read = a.getAccessToken();
  gate.resolve();
  await write;
  assert.equal(await read, operation === "replace" ? B.accessToken : null);
  console.log("R2 deferred", operation, "read ordered");
}
// R3 latest completed rotation cannot be downgraded by delayed stale storage.
{
  const s = store();
  let calls = 0;
  const a = authority({
    baseUrl,
    credentials: s,
    fetcher: async () => {
      calls++;
      return ok(R);
    },
  });
  const revision = a.getSessionRevision();
  await a.refreshAfterUnauthorized(A.accessToken, undefined, revision);
  const stale = deferred<typeof A | null>(),
    started = deferred<void>();
  s.load = () => {
    started.resolve();
    return stale.promise;
  };
  const p = a.refreshAfterUnauthorized(A.accessToken, undefined, revision);
  await started.promise;
  stale.resolve(A);
  assert.equal(await p, R.accessToken);
  assert.equal(calls, 1);
  console.log("R3 stale snapshot", "one refresh");
}
// R4 exact uncertain recovery and fail-closed on a later caller beyond five minutes.
for (const expired of [false, true]) {
  const s = store();
  let now = 1000,
    calls = 0,
    sequence = 0;
  const keys: string[] = [],
    bodies: string[] = [];
  const a = authority({
    baseUrl,
    credentials: s,
    now: () => now,
    createIdempotencyKey: () => `key-${++sequence}`,
    fetcher: async (_u, i) => {
      calls++;
      keys.push(new Headers(i?.headers).get("Idempotency-Key")!);
      bodies.push(i?.body as string);
      if (calls <= 2) throw new TypeError("lost");
      return ok(R);
    },
  });
  const revision = a.getSessionRevision();
  await a
    .refreshAfterUnauthorized(A.accessToken, undefined, revision)
    .catch(() => {});
  now += expired ? 300001 : 299999;
  const result = await a.refreshAfterUnauthorized(
    A.accessToken,
    undefined,
    revision,
  );
  assert.equal(result, expired ? null : R.accessToken);
  assert.equal(calls, expired ? 2 : 3);
  assert.equal(new Set(keys).size, 1);
  assert.equal(new Set(bodies).size, 1);
  console.log(
    "R4",
    expired ? "past-window" : "recovery",
    calls,
    "calls, one key/body",
  );
}
// R5 policy on initial/replay/refresh retry; actual loopback redirect nondisclosure.
{
  const policies: string[] = [];
  let calls = 0;
  const a = authority({
    baseUrl,
    credentials: store(),
    fetcher: async (_u, i) => {
      policies.push(i!.redirect!);
      if (++calls === 1) throw new TypeError("lost");
      return ok(R);
    },
  });
  const c = client({
    baseUrl,
    session: a,
    fetcher: async (_u, i) => {
      policies.push(i!.redirect!);
      return new Headers(i!.headers).get("Authorization") ===
        `Bearer ${A.accessToken}`
        ? unauthorized()
        : ok({ saved: true });
    },
  });
  await c.request("/v1/houses", {
    method: "POST",
    body: { name: "fixture" },
    idempotencyKey: id,
  });
  assert.deepEqual(policies, ["error", "error", "error", "error"]);
  console.log("R5 policy", policies.join(","));
  let captured = 0;
  const sink = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (req) => {
      captured++;
      await req.text();
      return ok(R);
    },
  });
  const redirect = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      new Response(null, {
        status: 307,
        headers: { Location: `http://127.0.0.1:${sink.port}/capture` },
      }),
  });
  try {
    const a = authority({
      baseUrl: `http://127.0.0.1:${redirect.port}`,
      allowDevelopmentLoopback: true,
      credentials: store(),
    });
    await assert.rejects(a.refreshAfterUnauthorized(A.accessToken), TypeError);
    assert.equal(captured, 0);
    console.log("R5 actual loopback307", "zero sink requests");
  } finally {
    sink.stop(true);
    redirect.stop(true);
  }
}
// R6 required envelope IDs and primitive/closed session/error validation.
{
  let rejected = 0;
  const malformed = [
    { data: R },
    { data: R, requestId: 12 },
    { data: R, requestId: "bad" },
    ...["accessToken", "refreshToken", "expiresAt", "userId"].map((k) => ({
      data: { ...R, [k]: 12 },
      requestId: id,
    })),
    { data: { ...R, extra: true }, requestId: id },
  ];
  for (const payload of malformed) {
    const a = authority({
      baseUrl,
      credentials: store(),
      fetcher: async () => Response.json(payload),
    });
    await assert.rejects(a.refreshAfterUnauthorized(A.accessToken), {
      name: "ApiProtocolError",
    });
    rejected++;
  }
  for (const payload of [
    { data: {} },
    { data: {}, requestId: 12 },
    { error: { code: "forbidden", message: "x" } },
    { error: { code: "forbidden", message: 12 }, requestId: id },
    {
      error: { code: "forbidden", message: "x", fields: { x: 12 } },
      requestId: id,
    },
  ]) {
    const c = client({
      baseUrl,
      session: authority({ baseUrl, credentials: store() }),
      fetcher: async () =>
        Response.json(payload, { status: "error" in payload ? 403 : 200 }),
    });
    await assert.rejects(c.request("/v1/me"), { name: "ApiProtocolError" });
    rejected++;
  }
  console.log("R6 malformed fixtures rejected", rejected);
}
// Preserve same-family late401 and independent cancellation.
{
  const s = store(),
    gate = deferred<Response>();
  let calls = 0;
  const a = authority({
    baseUrl,
    credentials: s,
    fetcher: async () => {
      calls++;
      return gate.promise;
    },
  });
  const revision = a.getSessionRevision(),
    controller = new AbortController();
  const first = a
      .refreshAfterUnauthorized(A.accessToken, controller.signal, revision)
      .catch((e) => e),
    second = a.refreshAfterUnauthorized(A.accessToken, undefined, revision);
  await Bun.sleep(1);
  controller.abort();
  gate.resolve(ok(R));
  assert.equal((await first).name, "AbortError");
  assert.equal(await second, R.accessToken);
  assert.equal(
    await a.refreshAfterUnauthorized(A.accessToken, undefined, revision),
    R.accessToken,
  );
  assert.equal(calls, 1);
  console.log("preserved", "independent cancellation and same-family late401");
}
// Additional adverse interleaving: refresh save already started when logout/replacement begins.
for (const operation of ["logout", "replace"]) {
  const s = store(),
    saved = deferred<void>(),
    started = deferred<void>();
  let saveCalls = 0;
  s.save = async (v) => {
    if (++saveCalls === 1) {
      started.resolve();
      await saved.promise;
    }
    s.value = v;
  };
  const a = authority({ baseUrl, credentials: s, fetcher: async () => ok(R) });
  const refreshing = a.refreshAfterUnauthorized(
    A.accessToken,
    undefined,
    a.getSessionRevision(),
  );
  await started.promise;
  const newer = operation === "logout" ? a.logout() : a.replaceSession(B);
  saved.resolve();
  await Promise.all([refreshing, newer]);
  assert.equal(await a.getAccessToken(), R.accessToken);
  assert.equal(
    s.value?.accessToken ?? null,
    operation === "logout" ? null : B.accessToken,
  );
  let sent: string | null = null;
  const c = client({
    baseUrl,
    session: a,
    fetcher: async (_u, i) => {
      sent = new Headers(i?.headers).get("Authorization");
      return ok({ ok: true });
    },
  });
  await c.request("/v1/me");
  assert.equal(sent, `Bearer ${R.accessToken}`);
  console.log("RESIDUAL next API sends old rotated bearer", operation);
  console.log(
    "RESIDUAL deferred refresh save then",
    operation,
    "store=",
    s.value?.accessToken ?? null,
    "authority=",
    await a.getAccessToken(),
  );
}
// Additional adverse interleaving: old account 401 must not erase newer unresolved replay state.
{
  const s = store(),
    old = deferred<Response>(),
    started = deferred<void>();
  let mode = "old",
    sequence = 0;
  const keys: string[] = [];
  const a = authority({
    baseUrl,
    credentials: s,
    createIdempotencyKey: () => `key-${++sequence}`,
    fetcher: async (_u, i) => {
      if (mode === "old") {
        started.resolve();
        return old.promise;
      }
      keys.push(new Headers(i?.headers).get("Idempotency-Key")!);
      throw new TypeError("lost");
    },
  });
  const p = a.refreshAfterUnauthorized(
    A.accessToken,
    undefined,
    a.getSessionRevision(),
  );
  await started.promise;
  await a.replaceSession(B);
  mode = "new";
  const rev = a.getSessionRevision();
  await a
    .refreshAfterUnauthorized(B.accessToken, undefined, rev)
    .catch(() => {});
  old.resolve(unauthorized());
  await p;
  await a
    .refreshAfterUnauthorized(B.accessToken, undefined, rev)
    .catch(() => {});
  assert.deepEqual(keys, ["key-2", "key-2", "key-3", "key-3"]);
  console.log("RESIDUAL old401 erases new attempt", keys.join(","));
}
// Additional adverse interleaving: first network failure after replay window.
{
  let now = 1000,
    calls = 0;
  const a = authority({
    baseUrl,
    credentials: store(),
    now: () => now,
    fetcher: async () => {
      calls++;
      now += 300001;
      throw new TypeError("lost");
    },
  });
  await a
    .refreshAfterUnauthorized(A.accessToken, undefined, a.getSessionRevision())
    .catch(() => {});
  assert.equal(calls, 2);
  console.log("RESIDUAL retry beyond window", calls, "calls");
}
```
