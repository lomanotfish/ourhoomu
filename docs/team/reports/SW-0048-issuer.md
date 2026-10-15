# SW-0048 issuer verification report

## Result

Implemented the fail-closed `IssuerAdapter` verification component in the isolated `witchagorn/sw-0048-issuer` worktree. The implementation verifies signed JWTs using `jose` 6.2.10 and returns only `{ issuer, subject, authTime }`; it has no database, route, provider-switch, or token-to-email behavior.

Baseline: `cea98651dc844bd5fe5034540b4c767ddbbf52c5`  
Code commit: `0b8f45ebbc66e876f00b2dc52c17a9ea7da54d60`.

## Implementation

- Trusted per-provider configuration supplies issuer, audience, HTTPS JWKS URL, and allowed algorithms. Missing, malformed, or non-HTTPS configuration is rejected before key retrieval. The caller's expected audience must equal the trusted configured audience.
- `jwtVerify` checks the signature, configured algorithm allowlist, issuer, audience, expiry, and not-before (60-second clock tolerance); required claims include `iss`, `aud`, `sub`, `exp`, `nonce`, and `auth_time`.
- `auth_time` must be within five minutes and no more than 60 seconds in the future. The result contains only issuer, subject, and ISO authentication time.
- JWKS retrieval is injected for deterministic signed tests. `fetchTrustedJwks` accepts only HTTPS and rejects redirects, malformed responses, and transport failures with the same sanitized error. Token `jku`/`x5u` headers are ignored; retrieval receives only the configured URL.
- All verification errors use a fixed public message and do not include tokens, keys, email, or upstream errors.

## Verification

Run from `ourhoomu-api/` using Bun 1.4.3:

```sh
bun install --frozen-lockfile
bun run format:check
bun run lint
bun run typecheck
bun run test
```

All commands passed. Full unit suite: 27 tests across 3 files, 0 failures, 48 assertions. New issuer suite: 19 tests. It uses generated RSA signing keys and covers valid signed claims, unknown key, key rotation, wrong issuer/audience/nonce/algorithm, expired/future tokens, missing subject/nonce/auth-time/expiry, stale/future authentication time, absent/malformed provider configuration, expected-audience override, and attacker `jku`/`x5u` headers.

TDD evidence: the initial focused test failed because the issuer module was absent. Subsequent focused failures exposed test fixture expiry/not-before overrides and TypeScript typing errors; those were corrected, then the complete checks passed.

## Dependency source

Pinned `jose` 6.2.10 in the API manifest and lockfile. The maintainer documents `jwtVerify` signature and claim verification at [panva/jose v6.2.10 `jwtVerify`](https://github.com/panva/jose/blob/v6.2.10/docs/jwt/verify/functions/jwtVerify.md) and local JWKS handling at [panva/jose v6.2.10 `createLocalJWKSet`](https://github.com/panva/jose/blob/v6.2.10/docs/jwks/local/functions/createLocalJWKSet.md). The upstream package documents support for Cloudflare Workers and other Web Crypto runtimes at [panva/jose](https://github.com/panva/jose/tree/v6.2.10).

## Graft and runtime evidence

- `graft --version`: `0.21.1`.
- `graft build . --no-gitignore --no-ignore`: exit 0 from this worktree; local graph at `/Users/afe/orca/workspaces/ourhoomu/sw-0048-issuer/graft`.
- `graft map`: `ACTIVE`, exact worktree, 44 indexed files, 191 symbols, 510 edges. The new issuer paths are not in the pre-change graph and were read directly as new files.
- Graft reported `tokens saved ≈ 130,463` for the exact-worktree map call (one call). An initial map refreshed from the main checkout and was not used as exact-worktree source evidence.
- Codex shell parent process was PID 45423, launched with `--dangerously-bypass-approvals-and-sandbox`; global `/Users/afe/.codex/config.toml` sets `approval_policy = "never"` and `sandbox_mode = "danger-full-access"`. Orca terminal metadata identifies this as the connected Codex terminal in the assigned worktree.
- Orca mailbox check before verification and before reporting returned no follow-ups.

## Scope limits

This is a verification component only. No Google/Apple live issuer or native-device compatibility was tested; no runtime provider configuration, login handler, database, schema, session mapping, route, registry, or external Auth settings were changed. Live authentication and production use remain gated for the owning integration/review work.
