# SW-0050 independent issuer correction recheck

Verdict: **approve**, limited to the frozen issuer component correction. The original P2 additional-audience/malformed-audience/authorized-party finding is closed; no new blocking finding was observed. This is an independent component review, not acceptance of SW-0005 or permission to enable live login.

## Reviewed scope and runtime

- Reviewed source: `17281b70b5eed73ca6563d92e42a2255497907d4`; frozen source report/baseline: `21f6a32fa735dea46ab2b18c5ad3139ddd0f7fb0`.
- Isolated checkout: `/Users/afe/orca/workspaces/ourhoomu/sw-0050-issuer-recheck`; branch `witchagorn/sw-0050-issuer-recheck`; integration target remains Lead-owned `local`. Initial tracked working tree was clean.
- Worker: task `task_cffc1626674a`, dispatch `ctx_6ac52c3dc58d`, terminal `term_3fe39d18-5dd0-4ec1-96d3-19e64cf81ba8`.
- Read AGENTS, requirements, board, agent guide, API/core API contracts, local SW-0048 fix report, and authoritative amended SW-0048/SW-0050 tickets plus original SW-0050 review from `/Users/afe/Desktop/ourhoomu/docs/team/`. The local ticket is older; the authoritative amended ticket and dispatched scope govern this recheck.
- Used inline assigned security specialist scope; no security role profile was found in the installed Codex/agent filename search. Default model inherited without override; no nested workers or coordinator created. Applied security-and-hardening trust-boundary review and verification-before-completion.
- Actual launch evidence: `ps -p 97505,97009 -o pid,ppid,args` showed parent shell PID 97009 and this Codex PID 97505 running `codex --no-daemon --dangerously-bypass-approvals-and-sandbox`. Session instructions specify `approval_policy=never`, `sandbox_mode=danger-full-access`.
- Bun `1.4.3`, Node `v24.15.0`, installed Wrangler `4.150.0`, jose manifest pin `6.2.10`. No source, lockfile, runtime configuration, provider settings, DB, route, board or checklist edits.

## Finding closure and preserved boundaries

`ourhoomu-api/src/modules/auth/issuer.ts:63` now checks the full signed audience: the exact configured string or a one-element array containing that string. Additional audiences reject even when one is an explicitly trusted presenter; duplicate, numeric, nested, null, object and missing audience cases reject. This introduces no multi-audience trust policy.

At `issuer.ts:68`, any present `azp` must be a nonempty string in server-configured `trustedPresenters`. No allowlist, an empty allowlist, malformed claim values, unknown presenters and implicit equality to the backend audience all reject. An explicitly configured distinct native presenter passes with either exact string or singleton audience. Absent `azp` remains valid when the rest of the token is valid. `issuer.ts:38` rejects malformed presenter configuration before JWKS retrieval. Graft exhaustively found the new configuration only in the component and synthetic tests: no live profile or silent provider policy was added.

Diff inspection against original source `0b8f45e` shows only the optional configuration field, its validation, the new audience/presenter validator, and its invocation after `jwtVerify`; the prior signature/key/issuer/nonce/time/error handling remains intact. Independent signed probes reconfirm wrong issuer/nonce/subject/expiry/not-before/authentication time, foreign signature, unknown key, encryption-only key, wrong algorithm policy and caller audience mismatch all reject opaquely. Attacker `jku`/`x5u`/embedded `jwk` do not select key authority. Success exposes exactly issuer, subject and ISO authTime, never the signed email. Loader exceptions preserve the generic public error without a cause or attached upstream fields.

The existing 300-second authentication age, 60-second future authentication tolerance and 60-second JOSE expiry/not-before tolerance are preserved, including tested accept/reject boundaries. Original advisory limits remain: future `iat` is not independently constrained, JWKS operational timeout/size/cache policy is still an integration concern, and nonce consumption belongs to the session/challenge boundary. No claim of fixing or newly clearing those separately scoped concerns is made.

## Fresh verification

Commands below ran in `ourhoomu-api/` unless specified. All keys/claims were generated locally; probes inject JWKS and make no provider requests.

| Command | Observed result |
| --- | --- |
| `bun install --frozen-lockfile --ignore-scripts` | Exit 0; 64 packages installed, manifest/lock unchanged |
| `bun test` | Exit 0; 63 pass, 0 fail, 90 assertions, three files |
| `bun run typecheck` | Exit 0 |
| `bun run lint` | Exit 0; 15 files, no fixes |
| `bun run format:check` | Exit 0; 15 files, no fixes |
| `bun /tmp/sw0050-bun.ts` | Exit 0; 50 independent cases, 10 accepts and 40 opaque rejections |
| `bunx --no-install wrangler dev --config /tmp/sw0050-wrangler.jsonc --port 18856` then local `curl` below | Actual local workerd HTTP 200; same 50 results, exact JSON equality with Bun |
| Root `graft check` | Exit 0; wiring graph in sync; deep meaning layer not built |
| Root `git diff --check` | Exit 0 |

Workerd used compatibility date `2025-06-01` and an empty compatibility flag list, with no `nodejs_compat`. Local server was stopped after testing. This is actual workerd evidence for the component, not an HTTP API route or deployed Worker acceptance test. The previously reported 44-case review need not be repeated to establish this correction; the fresh full unit suite and following independent probes cover its affected trust boundary and surrounding regression checks.

## Reproduce the independent probes

Save the following as `/tmp/sw0050-recheck.ts`. Replace the absolute checkout prefix in its two imports with the reviewed checkout path if moved. Create `/tmp/sw0050-bun.ts` containing `import {run} from './sw0050-recheck.ts'; console.log(JSON.stringify(await run()));`.

Create `/tmp/sw0050-wrangler.jsonc` with:

```json
{"name":"sw0050-local-security-recheck","main":"/tmp/sw0050-recheck.ts","compatibility_date":"2025-06-01","compatibility_flags":[]}
```

From the API directory, run the Bun command and local Wrangler command above, then in another shell:

```sh
curl --fail --silent --show-error http://127.0.0.1:18856
```

The following script throws on any unexpected result, projection or public error shape. Its returned summary was `{"ok":true,"cases":50,"accepted":10,"rejected":40}` in both runtimes.

```typescript
import { createIssuerAdapter, IssuerVerificationError } from '/Users/afe/orca/workspaces/ourhoomu/sw-0050-issuer-recheck/ourhoomu-api/src/modules/auth/issuer.ts';
import { generateKeyPair, exportJWK, SignJWT } from '/Users/afe/orca/workspaces/ourhoomu/sw-0050-issuer-recheck/ourhoomu-api/node_modules/jose/dist/webapi/index.js';
export async function run() {
 const t=1800000000, issuer='https://issuer.example.test', audience='backend-A';
 const pair=await generateKeyPair('RS256'), other=await generateKeyPair('RS256');
 const jwk={...await exportJWK(pair.publicKey),kid:'key',alg:'RS256',use:'sig'};
 const config={issuer,audience,jwksUrl:'https://keys.example.test/jwks',algorithms:['RS256']};
 const base={iss:issuer,aud:audience,sub:'synthetic-subject',nonce:'nonce-A',auth_time:t-10,exp:t+120,email:'private@example.test'};
 const results:any[]=[]; let fetches=0;
 async function probe(name:string, claims:any={}, trustedPresenters:any=undefined, accept=false, options:any={}) {
  const token=await new SignJWT({...base,...claims}).setProtectedHeader({alg:'RS256',kid:'key',...options.header}).sign(options.foreign?other.privateKey:pair.privateKey);
  const adapter=createIssuerAdapter({providers:{google:{...config,trustedPresenters,...options.config}},now:()=>t*1000,getJwks:async(url)=>{fetches++; if(url!==config.jwksUrl)throw Error('wrong JWKS authority'); if(options.loaderError)throw Error('PRIVATE_UPSTREAM'); return {keys:[options.key??jwk]};}});
  let accepted=false;
  try {
   const value=await adapter.verifyIdToken({provider:'google',idToken:token,expectedNonce:'nonce-A',expectedAudience:audience,...options.input});
   accepted=true;
   if(JSON.stringify(value)!==JSON.stringify({issuer,subject:'synthetic-subject',authTime:new Date((claims.auth_time??base.auth_time)*1000).toISOString()}))throw Error('unexpected identity projection');
  } catch(e) {
   if(accepted || !(e instanceof IssuerVerificationError) || e.message!=='Identity token could not be verified' || e.cause!==undefined || Object.keys(e).some(k=>k!=='name'))throw e;
  }
  if(accepted!==accept)throw Error(name+': unexpected '+accepted);
  results.push({name,accepted});
 }
 await probe('exact string',{},undefined,true);
 await probe('singleton audience',{aud:[audience]},undefined,true);
 for(const [name,aud] of Object.entries({extra:[audience,'untrusted'],mixed:[audience,123],duplicate:[audience,audience],empty:[],null:null,number:123,object:{aud:audience},nested:[[audience]],wrong:'backend-B',missing:undefined}))await probe('aud '+name,{aud});
 await probe('extra trusted presenter still rejects',{aud:[audience,'native-A'],azp:'native-A'},['native-A']);
 await probe('extra untrusted presenter',{aud:[audience,'untrusted'],azp:'untrusted'});
 await probe('present azp absent policy',{azp:audience});
 await probe('present azp empty policy',{azp:'native-A'},[]);
 for(const [name,azp] of Object.entries({null:null,empty:'',number:123,array:['native-A'],object:{value:'native-A'},untrusted:'native-B',implicitBackend:audience}))await probe('azp '+name,{azp},['native-A']);
 await probe('explicit native presenter',{azp:'native-A'},['native-A'],true);
 await probe('singleton explicit native',{aud:[audience],azp:'native-A'},['native-A'],true);
 await probe('absent azp configured allowlist',{},['native-A'],true);
 await probe('explicit backend presenter',{azp:audience},[audience],true);
 for(const policy of [null,'native-A',[123],['']]){const before=fetches; await probe('invalid presenter policy '+JSON.stringify(policy),{},policy); if(fetches!==before)throw Error('invalid config fetched keys');}
 for(const [name,claims] of Object.entries({wrongIssuer:{iss:'https://evil.test'},wrongNonce:{nonce:'other'},missingNonce:{nonce:undefined},missingSubject:{sub:undefined},expired:{exp:t-61},futureNbf:{nbf:t+61},staleAuth:{auth_time:t-301},futureAuth:{auth_time:t+61},missingExpiry:{exp:undefined}}))await probe(name,claims);
 await probe('foreign signature',{},undefined,false,{foreign:true});
 await probe('unknown key',{},undefined,false,{header:{kid:'unknown'}});
 await probe('encryption key',{},undefined,false,{key:{...jwk,use:'enc'}});
 await probe('wrong algorithm policy',{},undefined,false,{config:{algorithms:['ES256']}});
 await probe('expected audience mismatch',{},undefined,false,{input:{expectedAudience:'other'}});
 await probe('upstream error privacy',{},undefined,false,{loaderError:true});
 await probe('header URL ignored',{},undefined,true,{header:{jku:'https://evil.test/keys',x5u:'https://evil.test/cert',jwk:await exportJWK(other.publicKey)}});
 await probe('auth age boundary',{auth_time:t-300},undefined,true);
 await probe('auth future boundary',{auth_time:t+60},undefined,true);
 await probe('expiry grace',{exp:t-59},undefined,true);
 return {ok:true,cases:results.length,accepted:results.filter(v=>v.accepted).length,rejected:results.filter(v=>!v.accepted).length,results};
}
export default {async fetch(){try{return Response.json(await run())}catch(e){return Response.json({ok:false,error:String(e)},{status:500})}}};
```

## Graft and handoff

**Graft: ACTIVE** in this exact checkout, CLI `0.21.1`. `graft ask 'issuer token audience trustedPresenters validation' --source --in ourhoomu-api` refreshed seven files from the main-checkout cache before retrieval and reported 45,539 estimated tokens saved. `graft grep 'validateAudienceAndPresenter|validConfig|requiredClaims' --in ourhoomu-api/src/modules/auth/issuer.ts` reported 937; `graft grep 'trustedPresenters' --in ourhoomu-api` found 12 hits across component/tests only and reported 3,681. Final `graft check` passed. Total tool-reported estimate: **50,157 tokens across three retrieval calls**, not measured billing savings. Raw reads were confined to documentation/configuration and the exact located validation span/diff needed for security inspection; no graph/cache committed.

Only this report is owned and committed. No source fixes, DB/provider calls, external deployment, merge, status update or worktree cleanup was performed. Production/live Google/Apple/Managed Auth, native-device, browser/HTTP route, session/challenge and full SW-0005 acceptance remain pending. Lead owns review acceptance, integration, worker release and cleanup; no blocking correction work remains for the reviewed component.
