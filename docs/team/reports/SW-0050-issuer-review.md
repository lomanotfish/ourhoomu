# SW-0050 independent issuer security review

Verdict: **changes_requested**. One blocking audience-trust finding (P2) is reproducible with freshly signed tokens in Bun and Cloudflare workerd. This reviews the frozen verification component only; it does not accept SW-0005, authorize route/database work, or clear live Google/Apple/Managed/native gates.

## Scope and preflight

- Reviewer: dispatched security-engineer, task `task_87d7f078bb47`, dispatch `ctx_ba62d7ec8d0e`; no nested workers.
- Exact worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0050-issuer-review`; branch `witchagorn/sw-0050-issuer-review`; initial tracked tree clean.
- Reviewed baseline/report commit: `a63807712596fc8907669191abf4c2ed06d13afa`; frozen implementation commit: `0b8f45ebbc66e876f00b2dc52c17a9ea7da54d60`.
- Authoritative newer ticket: `/Users/afe/Desktop/ourhoomu/docs/team/tickets/SW-0050.md` (read-only). Read requirements, board, agent guide, frozen SW-0048 report and accepted `docs/project/core-api-contract.md:13–15`/`:24`.
- Read Graft skill and `software-tech-lead/references/agent-runtime.md`; applied security-and-hardening trust-boundary review. Active configuration and trusted JWKS loader belong to the server; the JWT, claims and header URLs are untrusted. Assets are verified issuer/subject identity and the nonce-bound exchange; session/challenge consumption is outside this component.
- Launch proof: worker process `57785`, parent `57274`, observed via `ps -o pid,ppid,command -p 57785,57274`: `codex --no-daemon --dangerously-bypass-approvals-and-sandbox`. Session policy is `approval_policy=never`, `sandbox_mode=danger-full-access`; this grants no source-edit or integration ownership.
- **Graft: ACTIVE** in the exact worktree. CLI `graft --version` returned `0.21.1`; `graft ask 'IssuerAdapter JWT verification JWKS configuration' --source` located `issuer.ts:81–113` and its tests; `graft grep IssuerAdapter` found seven hits across two files, searching 46 indexed files. `graft check` exited 0 at final review checkpoint. Raw reads were limited to located security details, unindexed documentation/configuration and installed dependency implementation. No index/cache committed.
- Graft retrieval was invoked three times (the initial batched query, a repeated query to recover unreadable compressed output, and grep). Recovered savings lines were 42,995 and 2,555: **45,550 observed tokens subtotal**; no savings attributed to the unreadable first response. These are tool estimates, not measured billing savings.

## Blocking finding

### F1 — P2: additional audiences are accepted without a trusted audience/presenter policy

Location: `ourhoomu-api/src/modules/auth/issuer.ts:96–107`, particularly `audience: config.audience` at line 102; claim post-validation at `:60–79` never examines the complete `aud` list or `azp`.

A cryptographically valid RS256 token with `aud: ['client-A', 'untrusted-client']`, the expected nonce, issuer and recent authentication time is accepted when the only configured audience is `client-A`. A token with that audience list and `azp: 'untrusted-client'` is also accepted. Both cases return the same verified identity as the baseline in Bun and workerd. Even `aud: ['client-A', 123]` is accepted, confirming that the complete claim shape is not validated.

`jose` performs audience membership, not application-specific trust validation: installed `jose/dist/webapi/lib/jwt_claims_set.js:64–70,123–125` uses an inclusion check. [OpenID Connect Core §3.1.3.7](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation) requires rejection when additional audiences are not trusted and recommends validating an authorized party when present. The adapter has no trusted extra-audience or presenter configuration, so a listed extra client cannot be established as trusted. This is an ID-token audience-boundary gap, not a signature forgery. No claim is made that a live provider currently issues this exact token shape or that a real account takeover was demonstrated; live compatibility is gated separately.

Required correction: validate `aud` as a nonempty string or an array containing only nonempty strings, require the configured audience, and reject additional audiences unless they are explicitly trusted by a reviewed server configuration. Until a multi-client policy is confirmed, reject extra audiences. Define a trusted `azp` policy alongside that decision; do not blindly assume a native presenter must equal a backend audience. Add signed regressions for untrusted extras, malformed arrays, and authorized-party mismatch, with positive fixtures only for explicitly approved multi-client configurations. Keep opaque failures and nonce binding.

## Other reviewed boundaries and limits

| Boundary | Assessment |
| --- | --- |
| Signature and algorithms | `issuer.ts:99–106` delegates to JOSE/WebCrypto with a server-provided algorithm allowlist. Foreign signatures, HS256 confusion, `none`, unknown key ID, duplicate matching keys, incompatible key algorithm and encryption-only key usage reject. An unsupported configured algorithm fails closed through JOSE. The component does not provide production provider profiles; supported algorithm choices still require trusted configuration review. |
| Issuer and configuration | Exact configured issuer and expected/configured audience equality apply at `:87–92,101–102`. Missing or malformed configuration fails before verification. Input does not supply issuer, JWKS URL or algorithm policy. Provider/config selection is caller-bound and must be validated by future handlers. |
| JWKS authority | `:97–98,115–130` loads only the trusted configuration URL, permits HTTPS without userinfo/fragment, and forbids redirects. JWT `jku`, `x5u` and embedded `jwk` do not change the loaded URL/key authority. Loader/key/JSON failures remain opaque. HTTPS alone does not bind a URL to a specific provider; that intentionally remains trusted deployment configuration, not client input. |
| Nonce | `:64–65,90` rejects missing/empty expected nonce and absent, non-string or mismatched signed nonce. The adapter does not consume a one-time challenge; that belongs to the separately gated session/handler boundary. |
| Time | `:28–29,66–70,103–106` requires finite `auth_time` and expiry. Authentication older than 300 seconds or more than 60 seconds ahead rejects; exact 300/60 boundaries accept. Expiry has the explicitly configured 60-second JOSE tolerance: 59 seconds expired accepts, 61 rejects. `nbf` beyond tolerance rejects. These tolerances must remain explicit in integration. |
| Issued-at advisory | A valid signature with `iat = now + 3600` and recent `auth_time` accepts; `iat` is not a required claim and no `maxTokenAge` is supplied. This does not bypass the required recent `auth_time`, expiry or nonce and is not a separate blocker under the accepted component contract. Consider requiring issuance time and rejecting future values when defining the live OIDC profile. |
| Subject and privacy | `:62–64,75–78` requires a nonempty string subject and returns only issuer, subject and ISO authentication time. Numeric/empty/missing subject rejects. Email and client user ID neither link identities nor escape in output. Mapping must preserve the issuer/subject tuple; mapping is not implemented or tested here. |
| Error privacy | `:31–36,109–110,129–130` returns a fixed `IssuerVerificationError` message without a cause. Signed negative probes, malformed token, loader secret exception, malformed JWKS/JSON and HTTP 503 all expose the same message. No token logging was found in the component. HTTP serialization/stack suppression must be checked when a handler is added. |
| Workers | Fresh standalone issuer probes ran in local workerd with compatibility date `2025-06-01` and **no `nodejs_compat` flags**, generated keys and verified signed JWTs successfully. No Node/Bun-only runtime API is required by the component. Existing production/fixture workerd checks also passed. This is local runtime proof, not deployed or live-provider proof. |
| Operational advisory | `fetchTrustedJwks` at `:119–122` has no application timeout, response-size cap or key cache; each verification loads a JWKS and creates a fresh local key set at `:97–98`. Slow/large trusted-provider responses can consume resources. Add bounded fetch/cache behavior and rate limits at the production integration boundary; not a newly invented prerequisite for this frozen component review. No availability test against a live endpoint was performed. |

## Fresh verification

Environment: Bun `1.4.3`, Node `v24.15.0`, frozen API lockfile; installed with `bun install --frozen-lockfile --ignore-scripts` (64 packages, no lockfile/source changes). Initial typecheck could not find `tsc` before installation; it passed after installation.

| Command (in `ourhoomu-api/`) | Fresh result |
| --- | --- |
| `bun run typecheck` | Exit 0 |
| `bun run lint` | Exit 0 |
| `bun run format:check` | Exit 0 |
| `bun test` | Exit 0; 27 pass, 0 fail, 48 assertions, three files |
| `RUNTIME_BASE_URL=http://127.0.0.1:18850 bun run check:runtime` | Exit 0; health, hidden proof route/unknown route 404, CORS |
| `RUNTIME_BASE_URL=http://127.0.0.1:18851 bun run check:fixture-runtime` | Exit 0; health, validation 400, missing auth 401, CORS |
| Independent signed script, Bun | 44 cases (34 opaque rejections, nine accepts, one fetch-policy check); exit 0; F1 accepts are explicitly recorded observations, not successful security rejection assertions |
| Same independent script, workerd at port 18852 | HTTP 200; 44 cases; parsed results exactly equal Bun results |
| `git diff --check` | Exit 0 before report creation; rerun before report commit |

The first runtime-check attempt used its default port 8787 and failed health-shape validation (HTTP 200 from an unrelated ambient service). It is not evidence for this checkout. Both checks were rerun against reviewer-started dedicated servers using explicit ports above. No database preparation, provider endpoint calls, production key/settings access, migrations or network-provider acceptance was performed. The Python extraction block was executed and the extracted script was rerun successfully, reproducing all 44 workerd results. Documentation standards were checked by reviewing relative references, fenced scripts and final whitespace; no graphical Markdown renderer was available in this worker.

## Reproduce independent probes

From the reviewed worktree root, extract the following fenced TypeScript block into `/tmp/sw0050-probes.ts`, replacing `__WORKTREE__` with the absolute worktree path. The only keys are generated locally and all identities/URLs are synthetic. The temporary global fetch replacement is a local stub; it never contacts a provider.

```python
from pathlib import Path
import json
root = Path.cwd()
report = (root / 'docs/team/reports/SW-0050-issuer-review.md').read_text()
script = report.split('```typescript\n', 1)[1].split('\n```', 1)[0]
Path('/tmp/sw0050-probes.ts').write_text(script.replace('__WORKTREE__', str(root)))
Path('/tmp/sw0050-run.ts').write_text("import { run } from './sw0050-probes.ts';\nconsole.log(JSON.stringify(await run(), null, 2));\n")
Path('/tmp/sw0050-wrangler.jsonc').write_text(json.dumps({
  'name': 'sw0050-issuer-independent-probe',
  'main': '/tmp/sw0050-probes.ts',
  'compatibility_date': '2025-06-01',
  'compatibility_flags': [],
}))
```

```sh
bun /tmp/sw0050-run.ts
cd ourhoomu-api
bunx wrangler dev --config /tmp/sw0050-wrangler.jsonc --port 18852
# In another shell:
curl -sS http://127.0.0.1:18852
# Existing package runtime servers, in separate shells:
bunx wrangler dev --config wrangler.jsonc --port 18850
bunx wrangler dev --config wrangler.runtime.jsonc --port 18851
```

```typescript
import { createIssuerAdapter, IssuerVerificationError, fetchTrustedJwks } from '__WORKTREE__/ourhoomu-api/src/modules/auth/issuer.ts';
import { generateKeyPair, exportJWK, SignJWT } from '__WORKTREE__/ourhoomu-api/node_modules/jose/dist/webapi/index.js';
export async function run() {
  const t = 1800000000, issuer = 'https://issuer.example.test', audience = 'client-A', nonce = 'challenge-A';
  const pair = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(pair.publicKey), kid: 'trusted', alg: 'RS256', use: 'sig' };
  const config = { issuer, audience, jwksUrl: 'https://jwks.example.test/keys', algorithms: ['RS256'] };
  const urls: string[] = [];
  const adapter = (cfg = config, keys: any[] = [jwk], load?: () => Promise<any>) => createIssuerAdapter({ providers: { google: cfg }, getJwks: load ?? (async url => { urls.push(url); return { keys }; }), now: () => t * 1000 });
  const claims = { iss: issuer, aud: audience, sub: 'subject-A', nonce, auth_time: t - 30, exp: t + 120, iat: t - 30 };
  const sign = (patch: any = {}, key = pair.privateKey, header: any = {}) => new SignJWT({ ...claims, ...patch }).setProtectedHeader({ alg: 'RS256', kid: 'trusted', ...header }).sign(key);
  const verify = (a: any, token: string, patch: any = {}) => a.verifyIdToken({ provider: 'google', expectedAudience: audience, expectedNonce: nonce, idToken: token, ...patch });
  const results: string[] = [];
  const reject = async (name: string, fn: () => Promise<any>) => { try { await fn(); throw new Error('ACCEPTED: ' + name); } catch (e) { if (!(e instanceof IssuerVerificationError) || e.message !== 'Identity token could not be verified' || e.cause) throw e; results.push('REJECT ' + name + ' opaque'); } };
  const accept = async (name: string, token: string) => { const out = await verify(adapter(), token); if (JSON.stringify(Object.keys(out).sort()) !== '["authTime","issuer","subject"]' || out.subject !== 'subject-A') throw new Error(name); results.push('ACCEPT ' + name); };
  await accept('baseline RS256', await sign({ email: 'private@example.test', userId: 'untrusted' }));
  for (const [name, patch] of Object.entries({ wrongIssuer: { iss: 'https://evil.test' }, wrongAudience: { aud: 'client-B' }, wrongNonce: { nonce: 'challenge-B' }, missingNonce: { nonce: undefined }, numericNonce: { nonce: 1 }, emptySubject: { sub: '' }, numericSubject: { sub: 1 }, missingSubject: { sub: undefined }, missingExpiry: { exp: undefined }, expired: { exp: t - 61 }, futureNbf: { nbf: t + 61 }, staleAuth: { auth_time: t - 301 }, futureAuth: { auth_time: t + 61 }, missingAuth: { auth_time: undefined }, stringAuth: { auth_time: String(t) }, missingIssuer: { iss: undefined }, missingAudience: { aud: undefined } })) await reject(name, async () => verify(adapter(), await sign(patch)));
  await reject('foreign signature', async () => verify(adapter(), await sign({}, other.privateKey)));
  await reject('unknown kid', async () => verify(adapter(), await sign({}, pair.privateKey, { kid: 'unknown' })));
  await reject('duplicate matching JWKS', async () => verify(adapter(config, [jwk, jwk]), await sign()));
  await reject('key encryption usage', async () => verify(adapter(config, [{ ...jwk, use: 'enc' }]), await sign()));
  await reject('key incompatible algorithm', async () => verify(adapter(config, [{ ...jwk, alg: 'RS512' }]), await sign()));
  await reject('expected audience mismatch', async () => verify(adapter(), await sign(), { expectedAudience: 'client-B' }));
  await reject('empty expected nonce', async () => verify(adapter(), await sign(), { expectedNonce: '' }));
  await reject('HTTPS config failure', async () => verify(adapter({ ...config, jwksUrl: 'http://evil.test' }), await sign()));
  await reject('empty algorithm allowlist', async () => verify(adapter({ ...config, algorithms: [] }), await sign()));
  await reject('malformed JWKS', async () => verify(adapter(config, [], async () => ({ keys: 'private-data' })), await sign()));
  await reject('JWKS exception', async () => verify(adapter(config, [], async () => { throw new Error('PRIVATE-TOKEN-DETAIL'); }), await sign()));
  await reject('malformed JWT', async () => verify(adapter(), 'PRIVATE-TOKEN-DETAIL'));
  const hs = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256', kid: 'trusted' }).sign(new Uint8Array(32));
  await reject('HS256 confusion', async () => verify(adapter(), hs));
  await reject('none algorithm', async () => verify(adapter(), btoa(JSON.stringify({ alg: 'none' })) + '.' + btoa(JSON.stringify(claims)) + '.'));
  await accept('embedded attacker key URLs ignored', await sign({}, pair.privateKey, { jku: 'https://evil.test/jwks', x5u: 'https://evil.test/cert', jwk: await exportJWK(other.publicKey) }));
  if (urls.some(url => url !== config.jwksUrl)) throw new Error('untrusted URL');
  await accept('expiry grace at 59s', await sign({ exp: t - 59 }));
  await accept('auth time exact 300s boundary', await sign({ auth_time: t - 300 }));
  await accept('auth time exact future 60s boundary', await sign({ auth_time: t + 60 }));
  await accept('OBSERVATION extra untrusted audience', await sign({ aud: [audience, 'untrusted-client'] }));
  await accept('OBSERVATION malformed audience array', await sign({ aud: [audience, 123] }));
  await accept('OBSERVATION mismatched authorized party', await sign({ aud: [audience, 'untrusted-client'], azp: 'untrusted-client' }));
  await accept('OBSERVATION future iat', await sign({ iat: t + 3600 }));
  const oldFetch = globalThis.fetch;
  let fetched = false;
  try {
    globalThis.fetch = (async (_url: any, init: any) => { fetched = true; if (init.redirect !== 'error') throw new Error('redirect policy'); return new Response(JSON.stringify({ keys: [jwk] })); }) as any;
    await fetchTrustedJwks(config.jwksUrl);
    if (!fetched) throw new Error('no fetch');
    results.push('FETCH trusted URL redirect error');
    await reject('URL userinfo', () => fetchTrustedJwks('https://user:pass@jwks.example.test/keys'));
    globalThis.fetch = (async () => new Response('SECRET', { status: 503 })) as any;
    await reject('fetch HTTP 503', () => fetchTrustedJwks(config.jwksUrl));
    globalThis.fetch = (async () => new Response('invalid SECRET JSON')) as any;
    await reject('fetch invalid JSON', () => fetchTrustedJwks(config.jwksUrl));
  } finally { globalThis.fetch = oldFetch; }
  return { cases: results.length, results };
}
export default { async fetch() { try { return Response.json(await run()); } catch(e) { return Response.json({ error: String(e) }, { status: 500 }); } } };
```

Observed results (identical Bun/workerd):

```text
ACCEPT baseline RS256
REJECT wrongIssuer opaque
REJECT wrongAudience opaque
REJECT wrongNonce opaque
REJECT missingNonce opaque
REJECT numericNonce opaque
REJECT emptySubject opaque
REJECT numericSubject opaque
REJECT missingSubject opaque
REJECT missingExpiry opaque
REJECT expired opaque
REJECT futureNbf opaque
REJECT staleAuth opaque
REJECT futureAuth opaque
REJECT missingAuth opaque
REJECT stringAuth opaque
REJECT missingIssuer opaque
REJECT missingAudience opaque
REJECT foreign signature opaque
REJECT unknown kid opaque
REJECT duplicate matching JWKS opaque
REJECT key encryption usage opaque
REJECT key incompatible algorithm opaque
REJECT expected audience mismatch opaque
REJECT empty expected nonce opaque
REJECT HTTPS config failure opaque
REJECT empty algorithm allowlist opaque
REJECT malformed JWKS opaque
REJECT JWKS exception opaque
REJECT malformed JWT opaque
REJECT HS256 confusion opaque
REJECT none algorithm opaque
ACCEPT embedded attacker key URLs ignored
ACCEPT expiry grace at 59s
ACCEPT auth time exact 300s boundary
ACCEPT auth time exact future 60s boundary
ACCEPT OBSERVATION extra untrusted audience
ACCEPT OBSERVATION malformed audience array
ACCEPT OBSERVATION mismatched authorized party
ACCEPT OBSERVATION future iat
FETCH trusted URL redirect error
REJECT URL userinfo opaque
REJECT fetch HTTP 503 opaque
REJECT fetch invalid JSON opaque
```

## Handoff

Only this report is changed/committed; implementation stays frozen. Lead owns the audience-policy decision, remediation ticket, review acceptance, local integration and Orca worker/worktree lifecycle. Keep the live Google/Apple/Managed/native gate pending and do not present these synthetic probes as provider or DB acceptance. Graft remains ACTIVE with a successful final freshness check; observed savings subtotal is 45,550 tokens across the two readable retrieval estimates (three retrieval calls made).
