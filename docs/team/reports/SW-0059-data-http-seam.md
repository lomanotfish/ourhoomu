# SW-0059 — core HTTP data and auth replay seam

## Delivery and source

Worker implementation delivered for independent data/security review, not Lead
acceptance or integration. Task `task_c2ac965664a4`, live dispatch
`ctx_f28db1309590`, worker terminal `term_f67f381d-c617-42f0-a933-c45cd7e3de4d`.
Worktree `/Users/afe/orca/workspaces/ourhoomu/sw-0059-data-seam`, branch
`witchagorn/sw-0059-data-seam`, baseline
`6e8705e590ba7d656a2109ef0fad1e4de9cfb807` (includes accepted timezone/review
integration `9c04e73`). Tested implementation commit:
`10a0fffa6ee2899f3c17200f7580b1654f0cd550`.

The inherited dirty draft was explicitly assigned to this continuation and
preserved. No HTTP/auth handlers, DTO/shared contracts, manifests/lockfiles,
frontend, board, checklist or ticket status changed. No schema reset, role
recreation, merge, cleanup, deployment, provider or production operation ran.
The Lead retains integration/review and synthetic-window handoff authority.

## Implemented frozen interface

All methods below run on the existing principal transaction and retain current
actor/membership checks. Only approved DTO fields are projected.

| Method | Result and boundary |
| --- | --- |
| `me()` | `{id, displayName, houses}`; every current accessible house, no silent list cap |
| `houses(options)`, `house(houseId)` | `{id,name,timezone,version}`; current live membership |
| `members(houseId,options)` | `{id,displayName,role,active,version}`; live members only, no global user IDs |
| `ownMembership(houseId)` | `{id,version}` for the live actor only |
| `targetMembership(houseId,id)` | `{id,version}`; live same-house owner; an unexpired removed target may resolve for command retry |
| `accounts(options)`, `account(id)` | Owner-only `{id,version,bankCode,label,maskedAccount,isDefault,active}` |
| `accountSecret(id)` | Owner-only server record `{bankCode,identifierCiphertext,identifierDigest,keyVersion}` |
| `invitation(houseId,id)` | Owner-only `{id,houseId,expiresAt,createdAt,status}`; expired metadata hidden |

List options use UUID cursor ordered by ID, default20/max100. UUID cursors are
normalized to lowercase before the member list's lexical comparison. Dates stay
ISO timestamp/date strings and versions remain integers. Money implementation
was preserved; the full core suite still proves the exact dashboard string
`1350000000000` for three legal maximum bills.

Only `member.leave`, `member.remove` and `invite.accept` attach optional
`CommandResult.data` with the authorized member snapshot. Removal/leave include
`active=false`, incremented version and `removedAt`. These snapshots are tied to
the command actor/route/key/body locator and a maximum five-minute replay window.
No inactive-profile accessor was added. A departed actor cannot read/retry its
membership later. The target lookup does not weaken the existing command's
version/owner/session/family/house locks: lookup and command share one principal
transaction and an intervening committed version change returns409.

`invite.create` requires integer `expiresInSeconds` in1..604800. Expiry is
server statement time plus that TTL; encrypted replay is capped by both five
minutes and invitation expiry. Child locator access/deadline remains capped by
the invitation. Existing account update COALESCE preserves omitted identifier
ciphertext/digest/version atomically; `accountSecret` supports the HTTP adapter's
partial update. Archive stays irreversible through `account.update`.

## Auth authority and replay

The frozen typed calls are:

```ts
execute('challenge', { provider, proofDigest, keyDigest, bodyHash })
// { challengeId, expiresAt, replayed }
execute('exchange', { provider, challengeId, proofDigest, keyDigest, bodyHash,
  checkReplay: true })
// { pending: true } | { replayed: true, replayCiphertext }
execute('exchange', { provider, challengeId, proofDigest, keyDigest, bodyHash,
  issuer, subject, displayName, authTime, expiresAt, refreshExpiresAt,
  accessDigest, refreshDigest, replayCiphertext })
// { replayed, replayCiphertext }
```

There is no evidence-free production overload or process replay cache. Auth-role
calls must supply mandatory digest evidence; first use additionally validates
required verified-claim/credential fields before the private original exchange.
The service's signed current issuer verifier remains the authority that creates
those claims; SQL does not pretend to verify provider signatures or accept a
caller userId. The renamed original routine is private and cannot be invoked by
the restricted auth credential. Fixtures were updated to the new valid inputs.

Anonymous locators are keyed by route plus key digest, bind exact-body hash and
challenge, and never store raw tokens, nonce, account number or issuer/subject.
Production auth digests must be route-scoped server HMACs as frozen with the HTTP
worker. Challenge replay returns the same unexpired ID/time; changed body gives
`idempotency_conflict`409. Exchange preflight creates no session. First verified
exchange consumes the proof and inserts the session plus encrypted result
locator in one SQL transaction; concurrent same-key callers converge, while a
consumed proof under another key is401. The locator records a session reference
and encrypted credential result, not credential plaintext/digests or identity.

Replay takes the accepted family-root SHARE lock and re-reads both session and
locator after waiting. Revocation of any generation, rotation of the original,
inactive user, access/refresh expiry, missing/cleared ciphertext or elapsed
replay window denies401. The body-conflict409 remains distinct. Exact retry may
use the previously verified encrypted result after bootstrap challenge expiry,
within its own window and while original authority remains valid. Existing
rotate/revoke semantics and root/family lock order were preserved.

The HTTP service must decrypt the frozen purpose/key-version-bound envelope with
AAD `JSON([provider,challengeId,proofDigest,keyDigest,bodyHash])` and then call
`verifyAccessDigest` for canonical user/expiry. The DB returns no newly trusted
userId. This data test run does not establish the separate HTTP crypto adapter's
end-to-end compatibility or real issuer acceptance.

## Additive migration and canonical schema parity

Migration `0003_http_seam.sql` SHA256:
`1ce60b914ef2fd08edbe6fe2de52e53458433fc92b4c82fc628f8907adca20a4`.
Both new tables and nullable `idempotency_records.result_data` JSONB are in
`src/db/schema.ts`, additive `meta/0003_snapshot.json` and journal entry3. New
models/snapshots explicitly enable RLS. There is no SQL-only durable auth table.

| Object | Actual database protection/bounds |
| --- | --- |
| `auth_request_locators` | route/key composite PK; session FK; expiry index; digest/route CHECKs; `created_at < expires_at <= created_at+24h`; exchange replay at most5min; FORCE RLS; only writer DML policy; app/auth have no table privileges |
| `http_seam_migration_state` | singleton function-definition/SHA/fingerprint reversal metadata; FORCE RLS; migration-owner-only policy; no app/auth table privileges |
| `idempotency_records.result_data` | nullable JSONB; runtime command-only member replay; cleared after replay window by existing janitor |

`check-http-schema.ts` uses actual guarded catalog results and compares new
column names/types/nullability/defaults, CHECK names, locator PK/FK and expiry
index against canonical Drizzle and the additive snapshot. It asserts actual
FORCE RLS and denied app/auth table privileges, verifies `result_data` in all
three representations, and proves actual CHECK refusal for0/86401-second
anonymous locator TTL. Custom policy/grant/FORCE and routine definitions remain
owned by the reviewed SQL migration, following the existing custom-migration
pattern. Offline generation alone is not the parity evidence.

`patch-http-seam` requires the accepted existing core, takes an advisory
migration lock, and stores candidate SHA plus routine fingerprints. Exact
reapply is a no-op; changed routine fingerprints refuse both apply/rollback.
Unknown command predecessors refuse atomically. New routine ownership needs a
transaction-local schema CREATE grant to writer; it is revoked before commit.
Existing command/cleanup routines are replaced in place; original auth routine
is privately renamed, not dropped. Roles and `runtime_probe` are preserved.

`rollback-http-seam` refuses while any HTTP retry locator or command member
snapshot remains. On an unoccupied synthetic candidate it restores saved exact
accepted definitions, restores the original auth name/grant and removes only
new seam objects/column. Lifecycle tests first proved the refusal, deliberately
aged this exclusive window's disposable HTTP retry fixtures through the actual
janitor, and only then rehearsed rollback/reapply. Existing product/session
rows were not reset. The full `rollback` schema-reset mode was never used.

Accepted migration bytes were compared against baseline6e8705e and unchanged:

| File | SHA256 |
| --- | --- |
| `0000_core_schema.sql` | `bbdf30a4e26a4511cd118a47f6655c6228f227941cbdf41d6c99a848f924ec59` |
| `0001_core_operations.sql` | `9de69c5a2b4061067e34f73ce06febfd73346bcabaf2f5755afddaed1e6a45f6` |
| `0002_house_timezone.sql` | `50a54045bd69fdeb9695a95b8cd3f2b3ea168987354a922f1f2e9023c4c78f54` |

Five-minute access is enforced synchronously. Ciphertext/snapshot/locator
physical pruning requires the existing janitor to run; production scheduling,
physical deletion/backup/provider copies and operational guarantee remain
SW-0037/release gates. Tests proving the janitor's effect do not close them.

## Verification methods and commands

All database execution used the explicitly granted exclusive synthetic branch
`br-weathered-thunder-b38dgxbm`, endpoint `ep-dry-breeze-b3e8t69s` in project
`lucky-bar-14515304`, via the existing mode600 environment and branch-create
receipt. The guard pinned exact role/host/receipt/expiry before each connection.
No linked environment, production or pre-existing user dev branch was used.
Real app/auth checks authenticate as `ourhoomu_core_app` /
`ourhoomu_core_auth`, rather than owner impersonation or SET ROLE. Owner DDL,
backdating, catalog inspection and transactional fixture setup are explicitly
separate synthetic test techniques.

The actual command environment was:

```sh
export SYNTHETIC_DB_ENV_FILE=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env
export NEON_BRANCH_RECEIPT=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json
cd /Users/afe/orca/workspaces/ourhoomu/sw-0059-data-seam/ourhoomu-api
```

No credential values, raw tokens/nonces, account identifiers or production PII
are included in this report or locators. Auth fixtures use fresh UUID identities
at `https://synthetic.invalid`, current auth timestamps, access TTL900s and
refresh TTL2592000s. Fixture digest generation is SHA256 of fresh random UUIDs,
explicitly synthetic evidence-format setup, not a claim of real HMAC/provider
verification. The focused exchange test also stores a real AES-GCM credential
fixture, checks exact ciphertext replay/decryption and wrong-AAD refusal. Other
legacy fixture envelopes remain labeled synthetic. Projection fixtures use four
separate synthetic users/two houses; the list case creates23 accessible houses.

| Command (API directory) | Result at implementation SHA |
| --- | --- |
| `bun scripts/db/check-http-seam-lifecycle.ts` | 4 groups: exact reapply, fingerprint refusal, occupied refusal, exact unoccupied restore |
| `bun scripts/db/check-http-seam-migration.ts` | 2 groups: full transaction rollback with identities/security preserved, unknown predecessor refusal |
| `bun scripts/db/migrate.ts patch-http-seam` | additive commit; final candidate SHA above |
| `bun scripts/db/check-http-auth.ts` | 16 restricted-role groups |
| `bun scripts/db/check-http-schema.ts` | 4 actual-catalog/retention groups |
| `bun scripts/db/check-http-seam.ts` | 11 restricted-role groups |
| `bun scripts/db/check.ts` | 21 core groups |
| `bun scripts/db/check-sessions.ts` | 4 session groups |
| `bun scripts/db/check-session-races.ts` | 20 race groups |
| `bun scripts/db/check-house-timezone-migration.ts` | 3 timezone migration groups |
| `bun scripts/db/check-house-timezone.ts` | 10 timezone groups |
| `bun test tests` | 67 pass,0 fail;110 assertions across6 files |
| `bun run typecheck` | exit0 |
| `bun run lint` | exit0, no warnings |
| `bun run format:check` | exit0 |
| `bunx drizzle-kit check` | exit0 |
| `bunx drizzle-kit generate` | exit0, no schema changes |
| `git diff --check` | exit0 |

Auth coverage includes six concurrent same-key challenge/exchange callers,
different-key proof-consumption races, body conflict409, proof/provider/evidence
refusal, empty verified-claims refusal, preflight without session creation,
revocation/rotation/access expiry, exact previously verified bootstrap retry,
five-minute window, observed family-root lock waits and janitor effects.
`pg_blocking_pids` proves waits; neither the family-revocation test nor the
post-wait locator invalidation test relies on timing-only assertions.

Projection coverage includes owner/nonowner/cross-house/revoked/expired
boundaries; minimal field sets; account-secret denial to other household
members; label-only patch preserving encrypted values and version conflict;
archive/reactivation refusal; TTL1/604800 and missing/zero/negative/oversize/
fractional/NaN/string/bool/null inputs; exact encrypted invite replay/child caps;
revoked/expired invitation refusal; leave/remove snapshots and later404;
expired snapshot pruning; max100 validation/default20/uppercase UUID cursor and
uncapped /me. The membership race reads target version in one real principal
transaction, commits a competing role update in another restricted transaction,
and proves stale removal409 in the first transaction.

Durable logs/results are outside this disposable worktree under the common Git
directory:
`/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/SW-0059/`.
`db-check-results.json` and `offline-check-results.json` record exact commands,
exit status, source SHA and log paths. `run-db-checks.py` records the sequential
exclusive DB run; per-command logs preserve output. `immutable-migrations.json`
records baseline byte comparison hashes; `graft-final.log` records final exact
checkout retrieval. Iteration/RED logs are preserved alongside the final logs.

## Diagnosed failures and retry causes

- Inherited apply failed42501: accepted0001 revoked writer schema CREATE, so
  assigning new function ownership failed. Temporary transaction-scoped grant
  plus revoke fixed it; dry-run and lifecycle assert no lasting privilege drift.
- Initial replay RED: duplicate `challenge_proof` on exact retry demonstrated
  missing original challenge idempotency. DB-authoritative locator converges.
- Observed family-root wait RED returned replay after the locator was expired
  while blocked. Re-reading the locator after the lock fixed that stale result;
  the same test now denies401.
- Draft member replay used wall clock plus5min, exceeding the existing
  statement-created5min CHECK by milliseconds. Statement time plus bounded
  expiry fixes it without weakening constraints.
- Short-invitation test required encrypted replay capped at invitation expiry;
  migration now uses the minimum of invitation expiry and5min.
- Uppercase UUID cursor RED repeated the first member instead of the next.
  Normalization fixes the JavaScript comparison to agree with UUID order.
- Some expiry fixture backdates initially violated existing24h/five-minute/
  child-deadline CHECKs. The fixtures were corrected to valid bounded timestamps;
  no accepted constraint or production compatibility path was weakened.
- Initial typecheck had no local `tsc` executable. Pinned Bun1.4.3
  `bun install --frozen-lockfile` restored dependencies; manifests/lock untouched.
  Two early check invocations used the wrong directory and found no script;
  they made no DB calls and were rerun in the API directory.

## Runtime, Graft and handoff

Own live worker process PID59835 was observed with
`codex --no-daemon --dangerously-bypass-approvals-and-sandbox`; its child exec
parent confirmed the process relationship. This proves the current launch's
skip-permission flag, consistent with never/danger-full runtime policy. Model
was inherited, with no override or nested workers. Runtime permissions did not
expand ticket ownership.

🌱 Graft: ACTIVE — CLI0.21.1, exact SW-0059 checkout. Initial `graft map
--max-dirs 4` refreshed74files/376symbols/979edges. Subsequent source retrievals
included caller closure for SessionStore, data signatures and fixture call
sites; raw fallback was limited to SQL, docs/config, new unindexed files and
specific source ranges indicated by Graft. Final
`graft grep 'authRequestLocators|resultData|enableRLS' --in
ourhoomu-api/src/db/schema.ts` succeeded and refreshed the checkout index.
Twenty successful retrievals were made;19 visible numeric receipts sum to at
least405367 reported saved tokens. One compacted receipt's numeric tally was
unavailable, so no invented complete aggregate is claimed.

Final guarded verification completed on the implementation SHA:11 sequential
DB commands and7 offline commands exited0. All test pools were closed in their
finally paths; the runner exited and a process inspection found no remaining
DB check/runner process. At `2026-10-16T06:00:06.998Z`, the guarded final catalog
inspection found0 restricted-role transactions,23/23 forced-RLS core tables,
writer schema CREATE=false and the exact final migration SHA. Runtime probe
namespace OID24576 and app/auth/writer role OIDs41647/41649/41645 are preserved;
dry-run/rollback tests compare those identities with their before snapshots.
`final-db-state.json` records this inspection and its source SHA. The schema is
left with the final additive seam applied, not rolled back. This worker is ready
to relinquish its exclusive DB window and will make no further DB calls. The Lead must grant the next worker's window;
this report grants no independent DB authority. Independent data/security review
remains required before integration. Fixtures do not close HTTP acceptance,
live issuer/native login, provider, production, retention operations or release
gates.
