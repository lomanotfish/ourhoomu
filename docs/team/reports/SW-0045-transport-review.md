# SW-0045 — independent transport/session review

Verdict: **changes_requested**. Six required findings remain; fixture checks pass but do not cover these failures. Dispatch completion means the review is delivered, not that SW-0044 is accepted.

## Frozen scope and authority

- Reviewed source: `f7dec000563b8995927832cfa65658d077497371` (SW-0044), isolated worktree `/Users/afe/orca/workspaces/ourhoomu/sw-0045-transport-review`, branch `witchagorn/sw-0045-transport-review`. Original writer was frozen/settled per assignment. No implementation source was modified.
- Task `task_d53ad0d4043b`; Dispatch `ctx_f1fef56c238c`; worker terminal `term_6dc63e80-a38a-4036-a888-fe00f3ce2038`; coordinator `term_3477fed4-f980-4cc6-994c-81da695c46b2`.
- Read supplied AGENTS instructions, code-reviewer profile, runtime/Graft skills, project requirements/board/agent guide/core implementation, SW-0044, SW-0045 through `git show local:docs/team/tickets/SW-0045.md`, API/core API contracts, accepted OpenAPI and writer report. SW-0045 ticket is absent in the frozen snapshot; the assigned local ticket was read without switching checkout. `local` advanced during review; source remained frozen.
- `git diff --exit-code 7756bcc -- docs/project/openapi.yaml` passed: contract bytes match accepted `7756bcc`. In particular refresh exact replay binds old credential + key + body for five minutes; a different key revokes the family.
- Owned output is this report only. No code/test/contract/manifest/lock/status edits, nested agents, database/provider calls, deploy or push. Runtime permissions are supplied as `never`/`danger-full-access` by this session; no independent Orca launch-argv verification is claimed.

## Required findings

### R1 — P1: late 401 replays an old user's mutation as the replacement account

Location: `ourhoomu-front/src/session/authority.ts:120–124`; replay at `ourhoomu-front/src/api/client.ts:92–99`.

`refreshAfterUnauthorized` treats any different stored access token as a valid same-session rotation. It does not distinguish account replacement/logout and subsequent login from refresh. Start a keyed POST under A, hold its 401 response, await `replaceSession(B)`, then release the response. The client replays A's original JSON and key with **B's bearer token**, without a refresh. This can create a house, change B's account settings, or perform a mutation in a house shared by A and B under the wrong principal; server authorization cannot recover the original caller's intent.

Actual probe output: `late401_replay_accounts A,B`. Retain request/session lineage and allow the fast path only for a known rotation within the original account/session generation; reject stale requests across replacement/logout. Add an integrated client+authority regression with a delayed 401 after switching users, alongside the valid late-401-after-same-session-refresh case.

### R2 — P1: async credential reads escape logout/replacement ordering

Locations: `ourhoomu-front/src/session/authority.ts:116–117`, `142–148`; logout invalidates at `51–55`.

`replaceSession` waits for `credentials.load()` **before** capturing/incrementing its generation. Start replacement B with a delayed load that captured A, complete `logout()`, then resolve that load. Replacement now increments the post-logout generation and saves B: credentials are resurrected after a completed logout. Separately, `getAccessToken()` can return a captured A token after logout has completed because it has no generation check or synchronization with credential writes. The API can then issue a new authenticated fetch after local logout. Reads during a pending replacement save can likewise expose the old account.

Actual outputs: `replacement_after_logout user-b`, `token_after_logout true`. Establish operation ordering synchronously at invocation and make credential reads respect pending writes plus generation validity. Recheck after every async store operation; test deferred `load`, `save`, and `clear`, rather than only immediate memory storage. Logout invoked after an already-started replacement must win even if its store read completes later.

### R3 — P1: stale async storage snapshot starts a second refresh with an already-consumed credential

Location: `ourhoomu-front/src/session/authority.ts:122–132`; new key generated at `58–60`.

Hold caller one's `load()` with an A snapshot. Let caller two load A, complete refresh to R, persist R, and finish its flight. Release caller one's old snapshot. Generation has not changed during rotation, and the flight is now null, so caller one starts another refresh using A's old credential and a new key. The probe observes `late_storage_snapshot_refreshes 2`. Under accepted `/v1/auth/refresh` reuse semantics this second request revokes the otherwise healthy family. The later store comparison can prevent saving its result but cannot undo server revocation.

Serialize/revalidate the credential snapshot before starting a refresh and identify it by current credential lineage, not just the logout counter. Add a deferred-storage test where the first load wakes only after another rotation settles; the old credential must never be sent again with a new key.

### R4 — P1: exhausted refresh transport retries lose the exact replay key

Locations: `ourhoomu-front/src/session/authority.ts:58–80`, `133–137`.

The key/body are stable within one flight, but are discarded when its two network attempts reject. If the server processed the first attempt and both responses were lost, storage still holds the old refresh credential. A later unauthorized request creates a new flight and new key for that same old credential. Actual sequence: `fixture-key-1,fixture-key-1,fixture-key-2,fixture-key-2`. Accepted OpenAPI expressly revokes the family on that different-key reuse, so an ordinary transient outage can force logout instead of recovering the already-rotated session.

Retain an unresolved rotation's exact old credential/key/serialized body within the allowed replay window, or explicitly invalidate the uncertain local session instead of generating another key for the same old credential. Do not silently reuse it beyond five minutes. Add a fixture that models server commit followed by two lost responses, then recovery on a later caller. The probe proves the changed request keys; family revocation is the contract-defined consequence, not a live API observation.

### R5 — P1: automatic redirects forward the refresh credential body outside the configured origin

Locations: `ourhoomu-front/src/session/authority.ts:61–74`, `165–170`; the normal client also omits redirect policy at `ourhoomu-front/src/api/client.ts:77–83`, `99`.

Both fetch paths use default redirect following. URL validation protects only the initial URL. A 307 redirect to another origin preserves the POST body; the refresh credential is in that body even if the runtime strips `Authorization`. Two ephemeral loopback servers with different ports, using actual Bun fetch and synthetic credentials, reproduced `cross_origin_redirect_received_refresh_body true`. The authority accepted the redirected response as a new session. A misconfigured/compromised API redirect can therefore disclose a refresh credential; an HTTPS redirect target could do the same, and initial HTTPS validation does not constrain later hops.

Fail closed on redirects for authenticated/credential-bearing calls and verify the chosen behavior in supported runtimes. Checking `response.url` only after an automatic follow is too late to prevent disclosure. Add request-policy assertions for initial/replay/refresh retries plus a local redirect regression. No native redirect behavior is inferred from Bun; native transport must prove equivalent protection before integration.

### R6 — P2: malformed refresh/error envelopes are accepted as valid

Locations: `ourhoomu-front/src/session/authority.ts:180–195`; `ourhoomu-front/src/api/errors.ts:64–67`, `103–105`.

Accepted success/error envelopes require `requestId`. Refresh checks only `data` and four string fields, so `{data: session}` is persisted without an envelope request ID. Error parsing makes the required ID optional and returns `ApiHttpError` for `{error:{code:'forbidden',message:'fixture'}}`, rather than `ApiProtocolError`. Actual outputs: `missing_refresh_requestId_accepted true`, `missing_error_requestId_error_type ApiHttpError`. Existing malformed fixtures exercise missing data/currentVersion but miss these required-envelope fields.

Apply consistent required-envelope validation on ordinary success, refresh success and error paths; test absent/non-string request IDs and malformed session fields. OpenAPI also requires UUID/date-time shapes and forbids extra Session/Error properties; those stricter checks are not implemented. The reproduced required-field omission is sufficient for this finding; this review does not demand runtime validation of every generic endpoint DTO.

## Verification and coverage

Commands ran in the frozen checkout with Bun `1.4.3`, TypeScript `6.0.3`, Prettier `3.9.10`:

| Check                                                                      | Actual result                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `bun test src/api/transport.test.ts src/session/authority.test.ts`         | 15 pass, 0 fail, 69 assertions; rerun after installation also passed      |
| Initial `bun run typecheck` / `bun run format:check`                       | Failed to start: missing `tsc` / `prettier` in fresh worktree             |
| `bun install --frozen-lockfile`                                            | Passed, 575 packages; tracked lock/manifests unchanged                    |
| `bun run typecheck`                                                        | Passed after frozen install, exit 0                                       |
| `bun run format:check`                                                     | Passed after frozen install, all matched files formatted, exit 0          |
| `bun /tmp/sw0045-probes.ts`                                                | Twice reproduced all outputs below, exit 0; durable source embedded below |
| `git diff --check`                                                         | Passed before report; report checked again at handoff                     |
| OpenAPI vs `7756bcc`, generated DTO/types and manifest/lock vs frozen HEAD | No changes                                                                |

Existing fixtures demonstrate offline mutations blocked before fetch, caller-supplied JSON/key reuse on one authorized replay, one concurrent refresh with immediate storage, terminal refresh 401 local clear/cache callback, HTTPS/explicit loopback policy, and typed 403/404/409/currentVersion/410/429 with raw Retry-After preserved. Source inspection confirms caller options expose no arbitrary header override. External absolute/protocol-relative URLs are rejected and the resolved initial origin is compared; this does not address redirect hops. The test titled “does not replay an unkeyed mutation or recurse after a second 401” only exercises the unkeyed branch, so its title overstates coverage; source bounds replay to one attempt.

The independent cancellation probe aborts one waiter while another survives: `independent_cancellation AbortError true 1`. Caller abort is not passed into the shared refresh fetch, which correctly avoids one caller cancelling another's rotation. Existing logout/account replacement tests use immediate memory storage and therefore do not establish ordering under asynchronous native secure storage.

No source mutation test was performed because the assignment explicitly prohibits source/test edits. Concrete external probes establish the uncovered failures without changing implementation. No browser/UI work or production route testing was needed for this bounded review. Native secure storage, native redirect handling, real provider sessions, API handlers and database family revocation remain unproven; fixture results do not close SW-0009/native/API acceptance.

## Graft evidence

**Graft: ACTIVE** in `/Users/afe/orca/workspaces/ourhoomu/sw-0045-transport-review`, frozen source `f7dec000563b8995927832cfa65658d077497371`.

- `graft --version`: `0.21.1`.
- Initial `graft map` auto-copied/refreshed from the main checkout; this was followed by an explicit exact-worktree build before detailed source inspection. An early `ask` also preceded that explicit build. Their estimates are recorded separately and are not treated as exact-worktree savings evidence.
- `graft build --no-gitignore --no-ignore .`: exact output path `<worktree>/graft`; 43 supported files, 216 nodes, 476 edges; local ignored cache, no graph committed.
- Exact-worktree `graft grep 'createApiClient|createSessionAuthority|toApiError|parseRefreshSession' --in ourhoomu-front/src`: 27 hits across four files, reported 6,534 tokens saved.
- Exact-worktree `graft callers createSessionAuthority --depth 2` and `graft callers createApiClient --depth 2`: only fixture test consumers, reported 3,515 and 3,511 tokens saved. These modules are not yet wired into the UI.
- `graft check .`: wiring graph in sync; optional deep layer not built. Markdown/JSON OpenAPI and instructions read directly because they are not indexed; exact implementation ranges opened for full concurrency/error inspection beyond Graft excerpts.
- Exact-worktree retrieval tally: **13,560 reported tokens saved across three calls**. Initial map/ask reported 83,557 + 43,864 separately; all five retrieval calls total 140,981, with the initial copied-cache limitation above. No measured runtime/token reduction is claimed beyond Graft's estimates.

## Reproduction source and observed output

Save the following as `/tmp/sw0045-probes.ts`, then run `bun /tmp/sw0045-probes.ts` while the frozen checkout remains at the path shown. Imports reference frozen implementation files; all credentials are synthetic labels. The local redirect fixture opens two ephemeral loopback listeners and closes both in `finally`. The script makes no external requests; other requests use injected fetch fixtures.

```ts
import { createSessionAuthority } from "/Users/afe/orca/workspaces/ourhoomu/sw-0045-transport-review/ourhoomu-front/src/session/authority";
import { createApiClient } from "/Users/afe/orca/workspaces/ourhoomu/sw-0045-transport-review/ourhoomu-front/src/api/client";
const A = {
  accessToken: "fixture-a",
  refreshToken: "fixture-ra",
  userId: "user-a",
  expiresAt: "2026-10-14T12:00:00Z",
};
const B = {
  ...A,
  accessToken: "fixture-b",
  refreshToken: "fixture-rb",
  userId: "user-b",
};
const R = {
  ...A,
  accessToken: "fixture-rotated",
  refreshToken: "fixture-rrotated",
};
const ok = (data: any) => Response.json({ data, requestId: "fixture-request" });
const unauthorized = () =>
  Response.json(
    {
      error: { code: "unauthenticated", message: "unauthorized" },
      requestId: "fixture-request",
    },
    { status: 401 },
  );
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
const store = () => ({
  value: A as typeof A | null,
  async load() {
    return this.value;
  },
  async save(v: typeof A) {
    this.value = v;
  },
  async clear() {
    this.value = null;
  },
});
const baseUrl = "https://fixture.invalid";
// Paused replacement begins before logout; its read completes afterwards.
{
  const s = store(),
    load = deferred<typeof A | null>();
  s.load = () => load.promise;
  const a = createSessionAuthority({ baseUrl, credentials: s });
  const replacement = a.replaceSession(B);
  await a.logout();
  load.resolve(A);
  await replacement;
  console.log("replacement_after_logout", s.value?.userId);
}
// Paused credential read captures A, then logout completes.
{
  const s = store(),
    load = deferred<typeof A | null>();
  s.load = () => load.promise;
  const a = createSessionAuthority({ baseUrl, credentials: s });
  const token = a.getAccessToken();
  await a.logout();
  load.resolve(A);
  console.log("token_after_logout", (await token) === A.accessToken);
}
// Mutation under A receives a late 401 after replacing A with B.
{
  const s = store(),
    first = deferred<Response>(),
    started = deferred<void>();
  const headers: string[] = [];
  const a = createSessionAuthority({ baseUrl, credentials: s });
  const c = createApiClient({
    baseUrl,
    session: a,
    fetcher: async (_u, i) => {
      headers.push(new Headers(i?.headers).get("Authorization")!);
      if (headers.length === 1) {
        started.resolve();
        return first.promise;
      }
      return ok({ saved: true });
    },
  });
  const p = c.request("/v1/houses", {
    method: "POST",
    body: { name: "old-account-draft" },
    idempotencyKey: "fixture-key",
  });
  await started.promise;
  await a.replaceSession(B);
  first.resolve(unauthorized());
  await p;
  console.log(
    "late401_replay_accounts",
    headers
      .map((h) =>
        h === `Bearer ${A.accessToken}`
          ? "A"
          : h === `Bearer ${B.accessToken}`
            ? "B"
            : "?",
      )
      .join(","),
  );
}
// An older storage snapshot wakes after another caller already rotated.
{
  const s = store(),
    stale = deferred<typeof A | null>();
  let loads = 0,
    calls = 0;
  s.load = async () => (++loads === 1 ? stale.promise : s.value);
  const a = createSessionAuthority({
    baseUrl,
    credentials: s,
    fetcher: async () => (++calls === 1 ? ok(R) : unauthorized()),
  });
  const delayed = a.refreshAfterUnauthorized(A.accessToken);
  await a.refreshAfterUnauthorized(A.accessToken);
  stale.resolve(A);
  await delayed;
  console.log("late_storage_snapshot_refreshes", calls);
}
// Exhausted network retries followed by another caller: server may already have rotated.
{
  const s = store();
  const keys: string[] = [];
  let sequence = 0;
  const a = createSessionAuthority({
    baseUrl,
    credentials: s,
    createIdempotencyKey: () => `fixture-key-${++sequence}`,
    fetcher: async (_u, i) => {
      keys.push(new Headers(i?.headers).get("Idempotency-Key")!);
      throw new TypeError("fixture-lost-response");
    },
  });
  await a.refreshAfterUnauthorized(A.accessToken).catch(() => {});
  await a.refreshAfterUnauthorized(A.accessToken).catch(() => {});
  console.log("lost_response_refresh_keys", keys.join(","));
}
// Missing envelope requestId is accepted by refresh and typed API error parser.
{
  const s = store();
  const a = createSessionAuthority({
    baseUrl,
    credentials: s,
    fetcher: async () => Response.json({ data: R }),
  });
  console.log(
    "missing_refresh_requestId_accepted",
    (await a.refreshAfterUnauthorized(A.accessToken)) === R.accessToken,
  );
  const c = createApiClient({
    baseUrl,
    session: a,
    fetcher: async () =>
      Response.json(
        { error: { code: "forbidden", message: "fixture" } },
        { status: 403 },
      ),
  });
  try {
    await c.request("/v1/me");
  } catch (e: any) {
    console.log("missing_error_requestId_error_type", e.name);
  }
}
// Local real HTTP redirect fixture, both servers ephemeral and synthetic only.
{
  let receivedBody = "";
  const sink = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (req) => {
      receivedBody = await req.text();
      return ok(R);
    },
  });
  const origin = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      new Response(null, {
        status: 307,
        headers: { Location: `http://127.0.0.1:${sink.port}/capture` },
      }),
  });
  try {
    const a = createSessionAuthority({
      baseUrl: `http://127.0.0.1:${origin.port}`,
      allowDevelopmentLoopback: true,
      credentials: store(),
    });
    await a.refreshAfterUnauthorized(A.accessToken);
    console.log(
      "cross_origin_redirect_received_refresh_body",
      receivedBody === JSON.stringify({ refreshToken: A.refreshToken }),
    );
  } finally {
    origin.stop(true);
    sink.stop(true);
  }
}
// One caller cancellation must not abort the shared refresh.
{
  const s = store(),
    pending = deferred<Response>(),
    started = deferred<void>();
  let calls = 0;
  const controller = new AbortController();
  const a = createSessionAuthority({
    baseUrl,
    credentials: s,
    fetcher: async () => {
      calls++;
      started.resolve();
      return pending.promise;
    },
  });
  const p = a
    .refreshAfterUnauthorized(A.accessToken, controller.signal)
    .catch((e) => e.name);
  const q = a.refreshAfterUnauthorized(A.accessToken);
  await started.promise;
  controller.abort();
  pending.resolve(ok(R));
  console.log(
    "independent_cancellation",
    await p,
    (await q) === R.accessToken,
    calls,
  );
}
```

Observed output (both runs):

```text
replacement_after_logout user-b
token_after_logout true
late401_replay_accounts A,B
late_storage_snapshot_refreshes 2
lost_response_refresh_keys fixture-key-1,fixture-key-1,fixture-key-2,fixture-key-2
missing_refresh_requestId_accepted true
missing_error_requestId_error_type ApiHttpError
cross_origin_redirect_received_refresh_body true
independent_cancellation AbortError true 1
```

## Lead handoff

Assign the six findings to the transport/session owner, freeze the corrected source and request an independent recheck, then run the scoped checks again in the integration target. Preserve the accepted contract and avoid expanding into provider/native implementation. This report changes no ticket status and performs no merge or cleanup; those remain Lead responsibilities.
