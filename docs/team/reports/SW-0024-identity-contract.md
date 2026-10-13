# SW-0024 — Google/Apple identity and API actor contract

**Research date:** 2026-10-13

**Worktree:** `witchagorn/sw-0024-identity-research`

**Planning base:** `f223f0d1137811951aff8ebaf6f1aba4e8da6d7e`

**Accepted product baseline:** `9e4c119`

**Status:** proposal for Tech Lead and user review; no provider login or deployment tested

## Executive finding

Neon Managed Better Auth remains a good fit for Google if its currently configured branch and the installed Neon client are proven to accept the required native ID-token flow. It is **not presently evidenced as a complete native Google + Apple solution**: the local Neon Auth skill's managed provider list is Google, GitHub, and Vercel, while native ID-token exchange for Apple is documented by upstream Better Auth but Neon explicitly restricts the managed SDK/provider surface. `auth: true`, an Auth URL, or a working Google flow alone must not be treated as evidence that either provider is configured.

If native Google and Apple tokens exchanged through the API are hard requirements, prefer one identity issuer that explicitly supports both flows end-to-end: either self-managed Better Auth on the chosen API host (candidate, not yet compatibility-proven on Elysia/Workers) or an external identity provider with native mobile SDKs and a verifiable JWT contract. Do not split Google and Apple across separate issuers without a reviewed identity-linking/migration plan. Keep Neon Postgres and the app-owned identity mapping regardless of provider choice.

## Source and evidence boundaries

I read the installed Neon Auth skill at `/Users/afe/Desktop/ourhoomu/.agents/skills/neon-auth/SKILL.md` and its `references/managed-auth.md` / `references/self-managed.md`. The skill says Managed Auth is Neon-hosted Better Auth with a fixed client/plugin surface; it documents Google social OAuth, not Apple, and warns that enabling `auth: true` does not implement login. Its plugin support table was checked 2026-09-17, so it must be refreshed before implementation. The linked production branch and its settings/credentials were not inspected, changed, or used.

Primary sources reviewed on 2026-10-13:

| Source | Relevant evidence | Limits |
|---|---|---|
| [Neon Auth plugin support](https://neon.com/docs/auth/guides/plugins.md) and [OAuth setup](https://neon.com/docs/auth/guides/setup-oauth.md) | Managed feature/provider boundary and provider setup are Neon-managed. | Neon docs served `text/markdown` and the browser tool could not render them; source URLs were opened but claims are cross-checked against the installed Neon skill. Refresh at implementation. |
| [Better Auth Expo integration](https://better-auth.com/docs/integrations/expo) | Expo client can submit native provider ID tokens; upstream says ID-token sign-in supports Google, Apple, and Facebook; native session cookies can be stored via SecureStore. | This is upstream Better Auth, not a guarantee for `@neondatabase/auth` Managed endpoints. Current page says Expo SDK 55 and Better Auth 1.7.7. |
| [Better Auth Google](https://better-auth.com/docs/authentication/google), [Apple](https://better-auth.com/docs/authentication/apple), [account linking](https://better-auth.com/docs/concepts/users-accounts) | Native ID-token examples, provider credentials, account linking defaults and delete-user controls. | Must confirm exact methods/configuration exist in the deployed Managed service or chosen installed self-managed version. |
| [Google backend verification](https://developers.google.com/identity/sign-in/ios/backend-auth), [OIDC guide](https://developers.google.com/identity/openid-connect/openid-connect), [OIDC reference](https://developers.google.com/identity/openid-connect/reference) | Validate signature, issuer, audience and expiry; do not trust client user IDs; production uses rotated public keys/JWKS; token revocation endpoint exists. | Google page's iOS SDK examples may differ from the selected Expo native library. |
| [Apple identity-token verification](https://developer.apple.com/documentation/signinwithapple/verifying-a-user), [Sign in with Apple flow](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple), [Apple nonce property](https://developer.apple.com/documentation/authenticationservices/asauthorizationopenidrequest/nonce) | Verify JWS signature, nonce, `iss`, `aud`, expiry; the first sign-in may be the only time name/email are supplied. | Bundle ID, Services ID, team grouping and token audience must be decided for the actual app. |
| [Expo auth SDK overview](https://docs.expo.dev/guides/using-authentication/), [Google auth](https://docs.expo.dev/guides/google-authentication/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) | Provider SDKs needing native code require a development build; SecureStore maps to iOS Keychain. | Expo Go is not a valid end-to-end native provider test. |
| [Neon current Free-plan limits](https://neon.com/blog/neon-free-plan-1-gb-per-project) | Published 2026-10-02: Managed Better Auth included up to 60,000 MAUs; current Free plan also lists Postgres/storage/compute limits. | Marketing plan limits can change; re-check account/region/plan before a cost commitment. |
| [Apple Developer Program](https://developer.apple.com/programs) | $99 annual membership; local currency/eligibility can vary. | Separate from any identity-provider hosting fees and app distribution details. |
| [Cloudflare Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) | Workers exposes Web Crypto APIs relevant to JWT verification. | Does not prove Better Auth, Elysia, Neon pooling, or a particular crypto library works in the selected deployment. |

The official Neon pages cited above returned a tool limitation because the site serves Markdown; the local installed Neon skill supplied the readable provider/managed-client evidence. This report therefore treats the managed Apple/native-token compatibility question as **unresolved**, not as a tested negative. Graft was used only for orientation because its generated index said it seeded from the root worktree; the evidence here is the listed primary documentation, not repository symbol search.

## Options

| Option | Google native ID token | Apple native ID token | Keeps Neon Managed Auth | Main trade-off |
|---|---:|---:|---:|---|
| Neon Managed Better Auth + Expo wrapper | Upstream supports it; Neon endpoint/wrapper compatibility still needs a real branch proof. | Not in the current Neon managed provider list; no official Neon evidence found that Apple exchange is exposed. | Yes | Lowest ops and branches with database, but does not yet satisfy both providers on evidence. |
| Self-managed Better Auth on API host + Neon Postgres | Upstream Expo/Google docs support it. | Upstream Expo/Apple docs support it. | No; one self-managed identity schema/issuer replaces managed identity for the app. | Closest API-native match and account controls; API hosting/runtime/adapter/migrations/rotation become our responsibility. Elysia-on-Workers compatibility and transaction/connection strategy remain unproven. |
| External IdP with native Expo SDKs + JWT validation by API | Provider-dependent; select one that documents native token exchange. | Provider-dependent; select one that documents Apple and team-scoped subject handling. | No, unless Neon only remains as an unrelated managed feature (not recommended). | Mature auth operations and provider SDKs; additional vendor cost/limits and a second identity service. Keep Neon DB; map only issuer + subject. |
| Browser OAuth redirects to Managed Auth | Google OAuth is documented. | Apple OAuth is not documented in Managed Auth's current supported-provider surface. | Yes | Could avoid native ID-token exchange, but still does not establish Apple support and differs from the requested native experience. |

**Proposed direction:** hold the decision until one bounded acceptance proof verifies Google and Apple on an isolated/dev auth branch with the actual Expo native build and API token validation. If the requirement cannot wait for that proof, choose a single self-managed or external issuer supporting both providers; do not add a bespoke Apple verifier beside Managed Google without explicit identity lifecycle ownership. No sign-in was performed for this report.

## Proposed identity/session sequence

```mermaid
sequenceDiagram
  participant App as Expo iOS app
  participant API as Elysia API / Workers
  participant IdP as Google or Apple
  participant Auth as One chosen session issuer
  participant DB as Neon pooled Postgres
  App->>API: POST /v1/auth/challenges {provider}
  API-->>App: {challengeId, nonce, expiresAt}
  App->>IdP: Native sign-in with challenge nonce
  IdP-->>App: provider ID token (and authorization code if available)
  App->>API: POST /v1/auth/exchange {challengeId, idToken}
  API->>API: consume challenge once; verify sig, iss, aud, exp, nonce
  API->>Auth: validate/create session for verified (issuer, subject)
  Auth-->>API: issuer session / session cookie
  API-->>App: app session cookie or app access + refresh credentials
  App->>API: Bearer short-lived access token + request
  API->>API: verify issuer/JWKS, claims, expiry; resolve app actor
  API->>DB: BEGIN; set transaction-local actor; run RLS-scoped query; COMMIT
  DB-->>API: authorized rows
  API-->>App: typed DTO
```

For Better Auth's upstream Expo integration, use its Expo client plugin and SecureStore-backed cookie/session handling; for Managed Neon, use only the Neon wrapper and the flow it actually exposes. Do not import `@better-auth/expo` into the Managed Neon client as a workaround: the Neon skill says the wrapper is not a drop-in for bare Better Auth and does not allow client-supplied plugins. For a cookie-backed session, Expo must forward the stored auth cookie to the API. For a bearer API, use the chosen auth SDK's supported short-lived JWT method; never forward a provider access token as the OurHoomu API credential.

## Proposed authentication contract for SW-0005 / SW-0009

These are DTO proposals for contract review, not implemented routes. They refine the logical `POST /auth/challenges`, `/auth/exchange`, `/auth/refresh`, `/auth/logout`, and `/me` rows in [api-contract.md](../../project/api-contract.md).

### Challenge and provider proof

1. `POST /v1/auth/challenges` accepts `{ provider: "google" | "apple", platform: "ios" }`. Server creates cryptographically random nonce and challenge ID, stores only a digest plus provider, expected client audience/config version, created/expiry times, and consumed state; use a short TTL (suggest 5 minutes), one use, per-IP/device throttling and no PII.
2. Return `{ challengeId, nonce, expiresAt }`. The native SDK request must bind the nonce according to the provider SDK; client-supplied state, user ID, email, audience or provider name is never an authority. Verify exact provider flow semantics for the selected Expo modules. Reject expired/reused challenges and nonce mismatch.
3. `POST /v1/auth/exchange` accepts `{ challengeId, idToken }` only over TLS. Keep raw token out of logs, analytics, crash reports, and idempotency storage. Do not accept an unverified `sub`, email, profile, Apple authorization code, or access token as identity. If Apple authorization code exchange is required for refresh/revocation, exchange server-side and store only protected credentials required by a reviewed policy.
4. Verify signature using issuer JWKS with cache/rotation; pin allowed algorithms; verify exact issuer, allowed `aud` (the configured iOS client ID / Apple App ID or Services ID expected for this flow), `exp`, `iat` sanity, and nonce/challenge binding. Check `azp` when present and relevant for multiple audiences. Never use Google `tokeninfo` in production; Google labels it debugging-only.
5. Account identity key is the exact pair `(issuer, subject)` (`iss`, `sub`) with an app-owned UUID as the stable foreign key. Treat email/name as mutable profile attributes, not unique identity keys. Apple subjects are developer-team scoped; a Team transfer requires Apple's user-migration procedure, not an email match.
6. Resolve/create the app user and provider identity in a database transaction with unique `(issuer, subject)`. If two first exchanges race, one insert wins and the other reads the winning user; never create duplicate users or mint two unrelated actors. Return the same public DTO for new and existing identities, with `created` only if needed by UX.

Suggested DTOs (claim names are examples; freeze schema and error codes in SW-0005):

```json
POST /v1/auth/challenges
{ "provider": "google", "platform": "ios" }

200 { "data": { "challengeId": "uuid", "nonce": "opaque-random", "expiresAt": "ISO-8601" } }

POST /v1/auth/exchange
{ "challengeId": "uuid", "idToken": "redacted-provider-jwt" }

200 {
  "data": {
    "accessToken": "our-api-jwt-or-managed-auth-jwt",
    "accessTokenExpiresAt": "ISO-8601",
    "refreshToken": "opaque-rotating-token-if-app-managed",
    "user": { "id": "app-user-uuid", "displayName": "optional" }
  }
}
```

Do not promise `refreshToken` or a custom claim from Neon Managed Auth until the actual API supports it. If using Managed Auth, prefer its native session + `.token()` JWT extraction with the Neon wrapper; the local skill documents 15-minute EdDSA JWTs and no custom claims. If Elysia cannot safely validate the issued session/JWT or there is no supported refresh handoff, stop and resolve the identity architecture before frontend implementation.

### Refresh, logout, revoke, and delete

- **Session refresh:** prefer refresh of the issuer session through its supported SDK/cookie mechanism; obtain a fresh API JWT as needed. If OurHoomu owns a refresh credential, make it opaque, hashed at rest, rotating, single-use, family-bound, expiry-limited, and revoke the whole family on reuse. Keep the provider's Google/Apple refresh token server-side only when needed for a defined provider API/revocation operation; the app never receives it.
- **Logout:** `POST /v1/auth/logout` revokes the app session/refresh family and clears SecureStore. Also end the upstream auth session through the issuer-supported operation. A previously minted self-contained JWT may remain valid until expiry unless the API checks a revocation/session state on every request. Neon Managed's documented 15-minute JWT implies a potential ≤15-minute stale-token window if API validation is stateless; choose and test an explicit policy. Do not claim immediate bearer revocation from cookie sign-out alone.
- **Revoke all devices:** provide an authenticated endpoint/action with recent reauthentication; invalidate upstream sessions and all app refresh families. Upstream Better Auth offers session/user management, but Managed exposure must be confirmed. Google offers a token revocation endpoint; Apple documents refresh-token revocation/validation. Revocation is distinct from terminating the API session and should not block local logout if the provider is unreachable.
- **Delete account:** require fresh authentication/confirmation; block or transfer ownership of active houses/bills under the domain rule; revoke all sessions and provider grants where supported; delete/deidentify provider mapping and auth profile under the approved retention/deletion policy; clean memberships, LINE bindings and personal data through the app deletion workflow. Neon auth schema deletion is not application account deletion. Better Auth's upstream hard-delete is disabled by default; Neon Managed support/configuration is not established here. Define asynchronous deletion status and retry/audit behavior without retaining provider secrets or indefinitely retaining personal identifiers.

### Linking policy

Propose **no implicit cross-provider linking by matching email**, including Apple's private relay email. Upstream Better Auth currently documents implicit linking of matching verified provider emails by default and a `disableImplicitLinking` option; Neon Managed settings are not established. For a self-managed implementation, explicitly disable implicit linking. Link Google/Apple only after a user is already signed in, requires recent reauthentication and proves the second provider with a fresh one-use challenge; enforce unique `(issuer, sub)`, reject an identity already linked elsewhere, notify the account, and preserve a way to sign in before allowing unlink. A same email is a UI hint only, never proof that two identities belong to the same person.

### Native client and API prerequisites

**Google:** create Google OAuth clients for the iOS app/bundle configuration and server/web audience as required by the chosen native SDK and server verifier. Configure reversed client ID/URL handling or native scheme per the selected Expo module; configure redirect URI only for redirect OAuth. On iOS, the official Google SDK can return a backend-verifiable ID token; send it to API over HTTPS. Keep any server client secret off device. Confirm `aud` values against every accepted client ID.

**Apple:** enable Sign in with Apple capability on the App ID and actual Xcode bundle ID; configure the Apple developer team, app grouping, and Services ID/domain/return URL only if the chosen backend flow needs web authorization/code exchange. Upstream Better Auth OAuth configuration needs client ID, Team ID, Key ID and private `.p8` key to produce its client-secret JWT; do not put that key in Expo. Apple's generated secret has maximum six-month expiry and requires rotation. Decide which audience is expected for the native iOS identity token and verify it exactly. Persist first-login name/email immediately if product UX needs them: Apple may return name only once; do not require email to identify the user.

**Expo:** native Google and Apple SDKs require a custom development build/config plugins; Expo Go is insufficient as final evidence. Use a registered app scheme/bundle ID, deep-link callback tests where browser redirects are involved, and `expo-secure-store`/iOS Keychain for auth cookies or refresh credential. Do not store tokens in AsyncStorage, logs, Zustand persistence, or demo cache. Clear credentials and in-memory API caches on logout/account switch. Expo package versions must be checked against the repo's selected Expo SDK before SW-0009 chooses dependencies.

**API / operations:** secret manager entries for provider client secrets/Apple `.p8`, issuer URLs, accepted audiences, and signing/refresh secrets; exact dev/stage/prod config and rotation owners; rate limits for challenge/exchange/refresh; request-size limits; redaction; JWKS cache with unknown-`kid` refresh and bounded outage policy; clock synchronization; audit event IDs without token material; and separate dev auth branch. Never ship any provider secret in `EXPO_PUBLIC_*` or app bundle. An enabled Neon Auth endpoint does not establish credentials, provider toggles, trusted callback/scheme, OAuth consent publishing, audience acceptance, or successful device flow.

## Trusted API actor → pooled Postgres/RLS proposal

1. Only the API has DB credentials; no Expo client or provider token connects to Postgres directly. Validate the chosen issuer token at API middleware (algorithm allowlist, signature/JWKS, issuer, audience where applicable, `exp`/`nbf`, and required subject). Extract the verified `(iss, sub)` and resolve `app_user_id` from app-owned identity table. Never derive actor, membership, role, `houseId` authority, or target user from request body/header/query parameters.
2. Build a typed immutable request principal, e.g. `{ appUserId, issuer, subject, authSessionRef? }`. Pass this context explicitly to services. Membership/house permission is looked up live for every operation; identity does not encode house authorization.
3. On a pooled DB connection, every scoped operation executes in one transaction: set transaction-local actor context such as `set_config('app.actor_id', appUserId, true)`, run all queries, then commit/rollback. Use `SET LOCAL`/transaction-local state, never a connection-level `SET`; otherwise the next pooled request may inherit a previous actor. Ensure all Drizzle calls are bound to that transaction/connection. RLS policies read only this verified context; use restrictive database roles without `BYPASSRLS`, and consider `FORCE ROW LEVEL SECURITY` where supported.
4. Do not accept arbitrary actor GUCs from the client. A custom GUC is not cryptographic: a component holding the DB credential can set it. This pattern protects against missing tenant filters and connection leakage, not a compromised API credential/process. Add independent resource membership predicates/constraints and narrow DTO projections.
5. **SW-0022 handoff recommendation:** use a request-scoped `@neondatabase/serverless` WebSocket connection for an interactive transaction, set the actor transaction-locally with parameterized SQL, and run the request's Drizzle work on that same transaction/connection. Keep complete SQL routines invoked over HTTP as the fallback when a request cannot use the interactive WebSocket transaction. This is a planning handoff, not evidence the driver/transaction has passed an integration smoke test; verify behavior on the selected Cloudflare Workers + pooled Neon endpoint before relying on it. Do not mix transaction-bound Drizzle work with a separate HTTP query client in the same logical mutation.

For Managed JWTs, Neon documents EdDSA/Ed25519, 15-minute expiry, and no custom claims in the installed skill. The Neon `sub` should be treated as an external issuer subject and mapped, not assumed to equal `public.users.id`; do not query undocumented `neon_auth` schema details as an application contract. Since Elysia runs on Cloudflare and is not a Neon Function, explicitly configure the correct branch's JWKS URL and issuer; do not assume Neon-injected `NEON_AUTH_JWKS_URL` exists in Workers. Pin issuer per environment/branch so a dev token cannot authenticate to production.

## Refresh, logout, and request race matrix

| Race / condition | Required behavior |
|---|---|
| Two native sign-in taps / responses for same challenge | Disable duplicate UI submit; server atomically consumes challenge once. Replay returns generic `challenge_used`/401 and creates no second identity/session. |
| Expired ID token, wrong issuer/audience, bad signature, nonce mismatch | 401 generic invalid provider proof; no user/session created; log safe reason code only. |
| Same `(iss,sub)` exchanged concurrently on two devices | Unique identity constraint + transaction returns one app user; no duplicate app-user rows. Session creation may be per device according to policy. |
| Same verified email from Google and Apple, identities not linked | Do not silently merge; show sign-in/link recovery path. |
| Explicit link races with same provider identity attached to another user | Unique constraint wins; return conflict, keep both accounts intact, alert current user; no reassignment. |
| Two API requests see expired access token and refresh simultaneously | Client single-flight refresh; server rotates refresh token atomically and treats second use as race/replay without revoking a legitimate winning session accidentally. If losing response, retry using latest stored credential once; otherwise require sign-in. |
| Refresh response arrives after logout/account switch | Generation/session ID guard prevents late response from restoring stale credentials or replacing the new account's tokens. |
| API returns 401 while another request is refreshing | Retry each safe request at most once with the newest token; never retry a mutation unless idempotency contract makes replay safe. |
| Logout and in-flight refresh | Serialize/mark local session revoking before network call; clear secure storage after response or definitive local logout; reject/ignore late refresh by generation; backend revocation idempotent. |
| Token revoked or account deleted while JWT still unexpired | Document stateless JWT window or check current session/revocation state; deny new protected requests within agreed SLA. No cached authorization beyond it. |
| Pooled connection reused by another actor | Transaction-local context reset by commit/rollback; regression test two different actors sequentially and after injected failure; no session-level actor state. |
| JWKS rotation / transient fetch failure | Cache keys per HTTP cache headers; on unknown `kid`, refresh once; stale known key may be accepted only within a bounded cache policy. Fail closed after expiry when signature can't be verified; do not fallback to unsigned decode. |
| Device reinstall / SecureStore unavailable / keychain restore | Treat as unauthenticated and reauthenticate; no insecure persistence fallback. |

## Cost and limits

- Neon published on 2026-10-02 that Free includes Managed Better Auth up to **60,000 monthly active users**. Auth itself may have no separate charge at this tier; database compute/storage, app hosting, provider policies, and any paid plan use remain separate and variable. Recheck the project's actual plan, AWS region eligibility, IP Allow/Private Networking restrictions, quotas, and the live Neon pricing page when implementation starts.
- The current Neon Free plan announcement lists per project 1 GB database storage, 100 CU-hours/month, 2 CU max autoscaling, 10 branches, 5 GB Object Storage, and auth up to 60k MAUs. These are total backend constraints, not an identity-only capacity promise; burst traffic and cold starts can still affect login/API latency.
- Self-managed Better Auth has no separate auth-vendor MAU line item in this design but consumes Cloudflare Worker invocations/CPU and Neon DB compute/storage, and adds on-call work for provider credentials, signing/JWKS, sessions, rate limits and incident handling. Verify current Workers Free quotas and Neon connection behavior in SW-0022/implementation; no price was inferred here.
- External identity vendors have plan-specific MAU, social connection and feature limits; compare current written pricing only after a vendor is selected. No vendor price was assumed.
- Apple requires developer enrollment for the Apple sign-in capability/production app workflow; Apple currently lists $99/year (or local-currency equivalent, with eligibility exceptions). The `.p8` signing key/client-secret lifecycle has rotation cost even when provider exchange itself is not billed per request.

## Choices to resolve before SW-0005/SW-0009 implementation

1. Is native Google **and** native Apple ID-token exchange mandatory, or may a supported browser OAuth flow satisfy R3? Existing requirements say Google and Apple through `ourhoomu-api`; the native mechanism should be confirmed as product policy.
2. Which single issuer owns app users/sessions: Neon Managed Better Auth, self-managed Better Auth, or a selected external IdP? Do not treat current Neon Auth enabled state as a provider credential/config proof.
3. Which audiences/bundle IDs/Apple App ID vs Services ID and Google client IDs are accepted in dev/stage/prod? Who owns credentials and rotation?
4. Is a 15-minute maximum stale JWT after logout/revoke acceptable, or must API revoke take effect immediately (requiring live revocation/session checks or opaque server-side sessions)?
5. Do we prohibit email-based implicit linking and require fresh reauthentication for explicit link/unlink? This report recommends yes.
6. What is the product deletion outcome for a user who owns a house or has retained bill history? Existing domain/retention rules require an application deletion workflow; auth hard-delete cannot decide it.
7. Can SW-0005 run an isolated native dev-build proof of Google and Apple against the selected issuer, plus refresh/revoke and two-user RLS-isolation checks, before SW-0009 treats login as integrated?

## Acceptance evidence still required

This is a source-backed paper design. It does not prove the configured Neon branch has Google enabled or credentials/redirects configured; it does not prove Neon Managed exposes Apple native ID-token exchange; it does not prove Expo SecureStore/native SDK wiring, Apple capability, real exchange, Worker JWT verification, Drizzle transaction-local actor propagation, RLS enforcement, refresh race handling, revocation, or account deletion. SW-0005/SW-0009 must verify those in a development build and isolated auth/database branch with secrets redacted. SW-0022 must complete its recommended WebSocket transaction + actor smoke test (and exercise the HTTP routine fallback if selected) before the actor-to-RLS proposal is accepted.

## Graft / workspace evidence

- `graft --version` → `0.21.1`.
- Exact worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0024-identity-research`.
- `graft build --no-gitignore --no-ignore` → parsed/replayed 26 supported files; built 110 nodes / 293 edges; output noted it seeded a starting graph from `/Users/afe/Desktop/ourhoomu`.
- `graft map` → 26-file frontend map; reported `tokens saved ≈ 29,825` on one call.
- `graft check` → wiring graph in sync; 110/110 nodes pending meaning summaries.
- Because the graph reported seeding from the root worktree, it was used only as orientation and not as source evidence for auth claims. No additional Graft token savings are claimed.
