# SW-0048 issuer audience and presenter correction

Component correction delivered for independent recheck; no acceptance or integration claimed.

## Scope and runtime

- Source/test commit: `17281b70b5eed73ca6563d92e42a2255497907d4`.
- Clean starting baseline: `a63807712596fc8907669191abf4c2ed06d13afa`.
- Worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0048-issuer`; branch `witchagorn/sw-0048-issuer`; integration target remains Lead-owned `local`.
- Task `task_1753f49f6467`, Dispatch `ctx_6e71a51f056b`, terminal `term_52a9e4bb-6d64-4e23-a833-a4112dd3c9d7`.
- Read authoritative amended SW-0048 ticket and SW-0050 review from Lead checkout `/Users/afe/Desktop/ourhoomu/docs/team/` (review d265d754), local AGENTS, requirements, board, agent guide, API/core API contracts, Graft skill, runtime guide and test-first guidance. Backend role profile was not available; used assigned inline specialist scope. No nested workers or user questions.
- Actual process evidence: `ps -p 82987,82538 -o pid,ppid,args` showed PID 82987 parent 82538 running `codex --no-daemon --dangerously-bypass-approvals-and-sandbox`; effective session instructions specify `approval_policy=never`, `sandbox_mode=danger-full-access`. Default model inherited; no model override added.
- Bun `1.4.3`, Node `v24.15.0`, installed Wrangler `4.150.0`, jose `6.2.10`; manifests and lock untouched.

## Change

After JOSE verifies the signed token, require `aud` to exactly equal the configured nonempty audience or be an array of length one containing that exact string. Reject every extra array member, including duplicates and malformed members. This closes F1 without adding a multi-client production policy.

The trusted server config type now permits optional `trustedPresenters: readonly string[]`. A present `azp` must be a nonempty string explicitly included in that allowlist. Missing or empty policy cannot authorize any presenter; absence of `azp` remains valid. Malformed policy fails before JWKS retrieval. Native presenter is never inferred from backend audience: the positive signed fixtures deliberately use a different presenter. No runtime configuration or live provider policy was added.

Existing signature/key, algorithms, issuer, expected audience, nonce, expiry/not-before, recent authentication time, HTTPS/JWKS authority, opaque error and minimal identity output checks are unchanged. No routes, database operations, manifests, lockfiles, app registry or provider settings changed.

Policy references: [OpenID Connect Core ID Token Validation](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation) requires trusted audiences and describes authorized-party validation; the exact single-audience and explicit presenter restrictions here follow the amended ticket. [jose jwtVerify API](https://github.com/panva/jose/blob/v6.2.10/docs/jwt/verify/functions/jwtVerify.md) remains the cryptographic verifier; application policy is applied to its verified payload.

## Red/green and checks

Commands below run in `ourhoomu-api/` unless marked otherwise. All signing keys and identities were generated locally/synthetic; injected JWKS avoids provider requests.

| Command | Observed result |
| --- | --- |
| `bun install --frozen-lockfile --ignore-scripts` | Exit 0; checked 64 installs across 146 packages, no changes |
| `bun test tests/auth/issuer.test.ts` before production edit | Expected exit 1; 29 pass, 26 fail, 64 assertions, 55 cases |
| Same focused command after correction | Exit 0; 55 pass, 0 fail, 64 assertions |
| `bunx biome format --write src/modules/auth/issuer.ts tests/auth/issuer.test.ts` | Exit 0; scoped formatting only |
| `bun run format:check` | Exit 0; 15 files, no fixes |
| `bun run lint` | Exit 0; 15 files, no fixes |
| `bun run typecheck` | Exit 0 |
| `bun test` | Exit 0; 63 pass, 0 fail, 90 assertions across 3 files |
| Local workerd signed probes below | HTTP 200; `ok:true`, 13 cases matching expected accept/reject |
| Root `git diff --check` | Exit 0 |

Report Markdown fences and paths were inspected; no graphical Markdown renderer was used.

Signed red cases reproduced extra audience, extra audience with untrusted presenter, numeric/malformed members, duplicates and unauthorized/malformed presenters. Already-rejected claim shapes remained green before the fix. Config-policy tests additionally prove malformed allowlists fail before fetching. Positive cases assert only issuer/subject/authTime output and cover string and singleton audiences, with and without explicitly configured distinct native presenter.

During test authoring Bun's `it.each` unpacked direct array rows instead of passing them as claim values. Wrapped those rows in objects, reran the corrected full red suite against the unchanged baseline source (26 failures), restored the fix and reran green. No test expectation was weakened to obtain green.

## Graft evidence

**Graft: ACTIVE** in this exact worktree; CLI `0.21.1`. Initial `graft grep audience --in ourhoomu-api/src/modules/auth/issuer.ts` found 5 hits in 3 symbols in the relevant indexed file (reported 872 estimated tokens saved). After source edit, `graft grep validateAudienceAndPresenter --in ourhoomu-api` refreshed two changed files and found the helper plus verification call (reported 1,088). After final test correction `graft check` initially reported the changed test stale; repeated the same retrieval, refreshing one changed file (reported 1,088), then `graft check` returned OK, wiring graph in sync. Docs/config read directly because not indexed code. An earlier preflight retrieval also reported 872, so total observed retrieval estimate is **3,920 tokens across 4 retrieval calls**, not billing savings. No graph/cache files committed.

## Reproduce local Workers probes

Save the following TypeScript block to `/tmp/sw0048-workers.ts`, replacing `__WORKTREE__` with the absolute checkout path. Write `/tmp/sw0048-wrangler.jsonc` with `{"name":"sw0048-local-issuer-fix-probe","main":"/tmp/sw0048-workers.ts","compatibility_date":"2025-06-01","compatibility_flags":[]}`. From `ourhoomu-api/` run `bunx --no-install wrangler dev --config /tmp/sw0048-wrangler.jsonc --port 18854`, then `curl --fail --silent --show-error http://127.0.0.1:18854` from another shell. The tested runtime had no nodejs_compat flag and returned four accepts and nine opaque rejections, all expected. Its process was stopped after the check.

An initial root-level `bunx wrangler` attempted dependency resolution; it was not used for the runtime proof, no initial bunx process remained at the server checkpoint, and no repository files changed. The observed running server used the installed package executable and Wrangler 4.150.0.

```typescript
import { createIssuerAdapter, IssuerVerificationError } from '__WORKTREE__/ourhoomu-api/src/modules/auth/issuer.ts';
import { generateKeyPair, exportJWK, SignJWT } from '__WORKTREE__/ourhoomu-api/node_modules/jose/dist/webapi/index.js';
export default { async fetch() {
  const now=1800000000, audience='backend-A', issuer='https://issuer.example.test';
  const pair=await generateKeyPair('RS256');
  const jwk={...await exportJWK(pair.publicKey),kid:'k',alg:'RS256',use:'sig'};
  const cases=[
    ['string', {aud:audience}, undefined, true],
    ['singleton', {aud:[audience]}, undefined, true],
    ['extra', {aud:[audience,'other']}, undefined, false],
    ['mixed', {aud:[audience,123]}, undefined, false],
    ['duplicate', {aud:[audience,audience]}, undefined, false],
    ['azp missing policy', {aud:audience,azp:audience}, undefined, false],
    ['azp null', {aud:audience,azp:null}, ['native-A'], false],
    ['azp empty', {aud:audience,azp:''}, ['native-A'], false],
    ['azp mismatch', {aud:audience,azp:audience}, ['native-A'], false],
    ['azp array', {aud:audience,azp:['native-A']}, ['native-A'], false],
    ['azp trusted', {aud:audience,azp:'native-A'}, ['native-A'], true],
    ['singleton trusted', {aud:[audience],azp:'native-A'}, ['native-A'], true],
    ['extra with trusted azp', {aud:[audience,'native-A'],azp:'native-A'}, ['native-A'], false],
  ];
  const results=[];
  for(const [name, claims, trustedPresenters, accept] of cases) {
    const adapter=createIssuerAdapter({providers:{google:{issuer,audience,jwksUrl:'https://keys.example.test/jwks',algorithms:['RS256'],trustedPresenters}},getJwks:async()=>({keys:[jwk]}),now:()=>now*1000});
    const jwt=await new SignJWT({iss:issuer,sub:'subject',nonce:'n',auth_time:now-30,exp:now+120,...claims}).setProtectedHeader({alg:'RS256',kid:'k'}).sign(pair.privateKey);
    let accepted=false;
    try { const output=await adapter.verifyIdToken({provider:'google',idToken:jwt,expectedNonce:'n',expectedAudience:audience}); if(JSON.stringify(output)!==JSON.stringify({issuer,subject:'subject',authTime:new Date((now-30)*1000).toISOString()})) throw Error('bad output'); accepted=true; }
    catch(error) {if(!(error instanceof IssuerVerificationError)||error.message!=='Identity token could not be verified')throw error;}
    if(accepted!==accept)throw Error('unexpected policy outcome: '+name);
    results.push({name,accepted});
  }
  return Response.json({ok:true,cases:results.length,results});
}};
```

## Limits and next owner

Only component-level unit and local Workers evidence. No live Google/Apple/Managed Auth, native provider, browser/HTTP route, DB, deployed Worker or session/challenge acceptance is claimed. Single-use nonce consumption, production provider profile compatibility and operational JWKS limits remain future integration responsibilities, unchanged by this correction. Lead owns independent SW-0050 recheck, acceptance, integration, statuses, release and worktree cleanup; this worker performed none of those actions.
