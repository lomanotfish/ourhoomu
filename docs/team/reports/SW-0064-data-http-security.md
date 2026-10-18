# SW-0064 independent data HTTP seam security review

## Verdict

**changes_requested** for the frozen SW-0059 candidate. One medium-priority
availability/lock-order defect remains in the janitor patch. No authorization
bypass or plaintext credential disclosure was found in the reviewed data seam.
The passing checks below do not waive that finding or establish HTTP/native/
provider/production acceptance.

Review performed 2026-10-16 in the new isolated checkout
`/Users/afe/orca/workspaces/ourhoomu/sw-0064-security-recheck`, branch
`witchagorn/sw-0064-security-recheck`. The existing
`sw-0064-data-review` checkout was inspected read-only: clean at the frozen SHA,
with no SW-0064 report present. Its ownership was not taken over.

Frozen source/report commit:
`67133eea39208a92f2c626041c7f8ec0d3a9b4df`; implementation parent:
`10a0fffa6ee2899f3c17200f7580b1654f0cd550`; reviewed diff baseline:
`6e8705e590ba7d656a2109ef0fad1e4de9cfb807`. The reviewed 0003 SQL SHA256 was
`1ce60b914ef2fd08edbe6fe2de52e53458433fc92b4c82fc628f8907adca20a4`.
After the initial lifecycle failure, Lead authorized the database owner's
fixture-only correction `f24cefe068de02160d6ef8adcb0e23e58d39101e`, cherry-picked
here as `911b4a9dd59dc2f8372b53ce3ff1808ac6b73f7f`. This changes only fixture
aging, not the reviewed application, SQL, or schema. No implementation fixes
were authored by the reviewer. No status/checklist edits or integration ran.

## Finding requiring correction

### P2 — Janitor reverses the accepted family/idempotency lock order

`ourhoomu-api/drizzle/0003_http_seam.sql:194–198` inserts the new
`UPDATE core.idempotency_records SET result_data=NULL ...` at the beginning
of `core.clear_replay_secrets()`, before its accepted session-family loop.
The loop takes each family root `FOR UPDATE`
(`0001_core_operations.sql:547–551`). In contrast, `core.command` takes the
actor family root `FOR SHARE` before locking an existing idempotency record
`FOR UPDATE` (`0001_core_operations.sql:118–124,177`).

A command can hold a family-root share lock while waiting for an idempotency
row held by the janitor; the janitor can then wait for that family's exclusive
root lock. PostgreSQL must abort a participant to break this cycle. The new
UPDATE also locks matching rows whose `result_data` is already NULL, widening
the overlap. The accepted cleanup previously acquired family locks before
updating idempotency records. This is a source-established lock-order defect;
a dedicated dynamic reproduction was **not** run, and the 20 existing session
race groups passing does not prove this new combination safe.

Required correction: retain family-root-before-idempotency order, preferably
folding result-data pruning into the final idempotency cleanup after the family
loop, and avoid rewriting already-cleared rows. Add a focused race check that
observes both competing locks and proves command/janitor completion without a
deadlock. Have the database owner supply a new frozen candidate; repeat the
affected migration/lifecycle, auth/data, and session checks before approval.
Lead selected a narrow revision of unaccepted 0003; accepted 0000–0002 remain
immutable. Fingerprint protection must not be bypassed.

## Initial verification failure and verified correction

The original `bun scripts/db/check-http-seam-lifecycle.ts` exited 1 after the
first three groups passed. Its broad fixture-aging UPDATE set
`replay_until=statement_timestamp()-1 second` while retaining an old
`created_at`, violating `idempotency_valid`'s five-minute upper bound on an old
synthetic `invite.accept` row (SQLSTATE 23514). The failure log is preserved;
the schema remained patched, and the routine-drift fixture had restored its
original function before the failure.

The database owner's correction caps the expired timestamp with
`LEAST(created_at+5 minutes, statement_timestamp()-1 second)`. At corrected
fixture SHA `911b4a9`, all four lifecycle groups and both transactional
migration groups passed. This resolves the fixture-repeatability defect only;
it does not resolve the janitor lock-order finding.

## Review boundaries and observed controls

- Anonymous challenge/exchange locators bind route, key digest, exact-body hash,
  provider/proof and challenge. First-use preflight returns pending without
  issuing a session. Exact concurrent challenge/exchange retries converge;
  changed body returns idempotency conflict, and consumed proof with another
  key/provider/proof returns unauthenticated. Missing evidence is rejected.
  Expired anonymous rows are also opportunistically cleaned during lookup, so
  pending means no authority creation/consumption, not a literally write-free
  SQL call.
- Exchange replay takes the existing family-root share lock and re-reads both
  session and locator after waiting. Fresh replay-window/locator/session/user/
  family checks deny replay after revocation, rotation, access expiry, cleared
  ciphertext or locator expiry. Actual tests observe root waits for committed
  revocation and replay-window expiry. The old auth entrypoint is private to
  the wrapper; restricted auth-role direct execution is denied. Original
  rotate/revoke definitions remain unchanged behind the wrapper.
- Locator retention is bounded to 24 hours, challenge to five minutes, and
  encrypted exchange replay to at most five minutes and original access expiry.
  Locators hold digests, challenge/session references and ciphertext rather
  than raw proof, nonce, tokens, issuer/subject or account identifiers.
  The AES-GCM fixture proves exact ciphertext roundtrip and wrong-AAD refusal.
  It uses the existing `db/replay.ts` helper; this does **not** independently
  verify the separate HTTP adapter's purpose/key-version envelope, exact raw
  body HMAC, live issuer validation or canonical token verification after
  decrypt. Those remain SW-0005/security HTTP integration checks. Database
  authority appropriately trusts the restricted server verifier credential,
  not a caller-supplied user ID.
- Projections use live actor/member checks and parameterized SQL. Own account
  and private encrypted account records are owner-only; wire projections have
  explicit field allowlists. Cross-house and removed-actor reads are hidden.
  Target membership exposes only ID/version to a current same-house owner,
  including an unexpired removed target for command retry. Removal/join/leave
  result snapshots are command-bound, bounded to five minutes, and pruned by
  cleanup. Removed actors cannot use them as a later read path.
- Actual app-role checks establish uncapped `/me` houses (23 fixtures), list
  default20/max100, cursor validation/normalization, invitation integer TTL
  1..604800 with exact encrypted retry and parent caps, version-conflict safety
  across a competing transaction, and account label-only update preserving
  encrypted identifier/digest/key version. Archive does not reactivate.
- New locator/migration-state tables and result-data column are present in
  canonical Drizzle, snapshot and actual catalog. Catalog checks compare
  columns/types/nullability/default presence, CHECK names, locator PK/FK and
  declared indexes; reviewed SQL/model constraints agree. This is not a claim
  that the script normalizes and compares every CHECK expression text.
  Both new tables have FORCE RLS; app/auth table privileges are denied. New
  SECURITY DEFINER routines have `search_path=pg_catalog`, explicit qualified
  relations, dedicated writer ownership and restricted EXECUTE grants.
- Accepted migration 0000–0002 bytes match baseline. Migration/reapply uses a
  transaction advisory lock plus candidate/function fingerprints, refuses
  unknown predecessors/drift, and refuses occupied rollback. Temporary writer
  CREATE is revoked before transaction commit. Transactional rehearsals and
  rollback preserve role OIDs, prior denied writer CREATE, functions and probe;
  no intermediate grant is committed. No evidence-free legacy runtime entry
  point was enabled. Physical pruning scheduling, full purge/backup retention
  and provider deletion evidence remain SW-0037/release gates, distinct from
  access expiry and the explicitly exercised cleanup function.

## Actual verification

The Lead explicitly granted this review's exclusive guarded synthetic DB
window. Prior process inspection found no DB check/runner process. Before
connecting, existing `loadTarget()` verified the mode600 explicit environment,
branch receipt, exact endpoint/roles, synthetic flags and expiry. Initial
catalog inspection found zero restricted-role transactions and writer schema
CREATE=false. No linked environment or production/provider connection was used.

Target: project `lucky-bar-14515304`, branch `br-weathered-thunder-b38dgxbm`,
endpoint `ep-dry-breeze-b3e8t69s`. Actual app/auth checks use separately
authenticated restricted credentials, not owner SET ROLE. Owner DDL, catalog
inspection and fixture backdating are labeled synthetic test techniques.

Commands ran from this checkout's `ourhoomu-api/`, with explicit path-only
bindings:

```sh
export SYNTHETIC_DB_ENV_FILE=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env
export NEON_BRANCH_RECEIPT=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json
```

| Command | Actual result |
| --- | --- |
| `bun scripts/db/check-http-seam-lifecycle.ts` at67133ee | FAIL23514 after3 passing groups; retained evidence |
| `bun scripts/db/check-http-auth.ts` at67133ee | PASS16 restricted auth-role groups |
| `bun scripts/db/check-http-schema.ts` at67133ee | PASS4 actual-catalog/TTL groups |
| `bun scripts/db/check-http-seam.ts` at67133ee | PASS11 restricted app-role groups |
| `bun scripts/db/check.ts` at67133ee | PASS21 core groups |
| `bun scripts/db/check-sessions.ts` at67133ee | PASS4 session groups |
| `bun scripts/db/check-session-races.ts` at67133ee | PASS20 race groups |
| `bun scripts/db/check-house-timezone-migration.ts` at67133ee | PASS3 migration groups |
| `bun scripts/db/check-house-timezone.ts` at67133ee | PASS10 timezone groups |
| `bun scripts/db/check-http-seam-lifecycle.ts` at911b4a9 | PASS4, including occupied refusal and exact unoccupied restore |
| `bun scripts/db/check-http-seam-migration.ts` at911b4a9 | PASS2: transactional restore and unknown-predecessor refusal |
| `bun scripts/db/migrate.ts patch-http-seam` at911b4a9 | PASS; exact original candidate reapplied |
| `bun scripts/db/migrate.ts rollback-http-seam` at911b4a9 | PASS; original candidate removed for corrected-owner handoff |

Offline observations: `bun install --frozen-lockfile --ignore-scripts` with
Bun1.4.3 passed without manifest/lock edits. `bun test tests` passed67 tests,
110 assertions,0 failures; `bun run typecheck`, `bun run format:check` and
`bun run lint` all passed (36 files format/lint, no fixes). Drizzle `check` and
`generate` via `bun x --no-install drizzle-kit` passed, with no schema changes.
Root `bun run check:contracts` passed through a Turbo cache; direct fresh
`bun run --cwd packages/contracts check:generated` then passed against OpenAPI.
`git diff --check` passed. No dependency changes or release audit was in scope.

Durable evidence (outside the disposable checkout) is under
`/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/SW-0064-independent/`:
`db-results.json`, `corrected-fixture-results.json`, `offline-results.json`,
per-command logs, `immutable-migrations.json`,
`final-old-candidate-rollback.log` and `final-state.json`. Initial API
unit/type/format/lint observations are in the execution transcript; they were
not represented as separately captured log files.

## Handoff and limitations

At `2026-10-16T09:43:31.088Z`, after explicit safe rollback, guarded inspection
found `auth_request_locators` and `http_seam_migration_state` absent, zero active
restricted-role transactions, writer CREATE=false, probe namespace OID24576,
and preserved writer/app/auth role OIDs41645/41647/41649. Pools closed in the
checked scripts' finally paths; process inspection found no remaining DB
check/runner. Reviewer released the exclusive DB window to Lead and will make
no further DB calls without reassignment. Accepted base schema remains; no
schema reset or production data operation occurred.

Next action: database owner corrects the janitor order and freezes the revised
candidate; Lead assigns independent recheck and a new exclusive window. Only
then can this verdict change. This report does not close HTTP acceptance,
native/live issuer, SlipOK, LINE, retention/backup or TestFlight gates.

Graft was used first for source context (CLI0.21.1); SQL/docs/new unindexed
files and exact indicated source ranges required direct reads. Successful
retrieval receipts total approximately18,253 estimated tokens saved in2 calls;
one unsupported `-n` grep invocation failed and contributes no savings.
