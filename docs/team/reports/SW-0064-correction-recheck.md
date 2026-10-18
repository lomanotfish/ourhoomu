# SW-0064 corrected data seam independent recheck

**Verdict: approve the corrected SW-0059 data seam at `244348c`.**
The reported janitor lock-order blocker and aged-fixture blocker are closed by
source inspection and fresh guarded verification below. This is a data-seam
security verdict; the Lead owns ticket acceptance and integration.

## Reviewed source and scope

Corrected candidate: `244348c519d7c1aba32334dead8c88d3abec3a27`, including
fixture correction `f24cefe068de02160d6ef8adcb0e23e58d39101e`. SQL SHA256:
`940d881e9b8e03c7f048ffd68e672755dd05e25e7d41d7dc89e06600fb1b590a`.
Review checkout:
`/Users/afe/orca/workspaces/ourhoomu/sw-0064-correction-recheck`, branch
`witchagorn/sw-0064-correction-recheck`, created from that exact commit.

This is the focused follow-up to the original frozen-source review report
commit `ecc04b6b1498e81b41a7c27896d2b1e3cbcbd7ca`. That review requested a
correction to janitor lock order and independently found a lifecycle fixture
aging failure. The original reports/evidence are retained. No application,
SQL, test source, manifest, status or checklist edits were authored in this
review checkout; only this report is a tracked reviewer change.

## Source correction assessment

The revised unaccepted 0003 keeps `clear_replay_secrets()`'s accepted family
loop unchanged and folds `result_data=NULL` into its existing final
idempotency UPDATE after the loop. It no longer locks idempotency records
before family roots. Rows with NULL replay deadline and no result payload are
excluded from the added cleanup condition. A legacy NULL-deadline payload is
still cleared. The old cleanup UPDATE anchor must occur exactly once or
migration raises `Unknown clear_replay_secrets predecessor for HTTP seam`;
this prevents silently missing the accepted cleanup predecessor.

The fixture change caps an aged replay deadline by the row's existing
`created_at+5 minutes`, preserving `idempotency_valid` even for hours-old
synthetic fixtures. Accepted 0000, 0001 and 0002 migration bytes match
`6e8705e590ba7d656a2109ef0fad1e4de9cfb807`; no accepted migration was rewritten.
The separate old-candidate rollback was completed before the database owner
applied this changed candidate. This review did not bypass migration hashes
or function fingerprints.

## Direct concurrent cleanup verification

An ad hoc verification probe was executed outside repository source, using the
existing guarded synthetic environment and trusted-verifier fixture helpers.
It created a rotated session family, a real restricted-role household and
membership removal, then expired that removal's five-minute result and the
original generation's refresh replay window using the migration owner. These
are synthetic fixture manipulations, not product mutation authority.

A separate owner transaction held the removal's idempotency row lock. The
actual restricted app-role `core.command('member.remove',...)` exact retry was
then observed blocked on that transaction while holding its family-root share
lock. The actual `core.clear_replay_secrets()` call was started concurrently;
`pg_blocking_pids` showed the janitor waiting on the command PID, rather than
the idempotency blocker PID. This directly establishes family-root-before-
idempotency behavior for the reported failing combination.

After releasing the fixture blocker, the expired retry returned the expected
`P0001/idempotency_conflict`, its transaction rolled back, and the janitor
completed without `40P01`. Catalog reads proved both the member result snapshot
and original session replay ciphertext/deadline were NULL afterward. All three
probe assertions passed. This is a controlled reproduction of the relevant
lock relationship, not a claim that every possible database workload is
deadlock-free.

## Migration security probes

The additional owner-only probe starts from the exact accepted base restored
by the lifecycle check, without resetting schema or dropping roles. It applies
the real candidate in a transaction up to its explicit CREATE revocation:
the migrating connection sees writer schema CREATE=true, while an independent
connection sees false. After the candidate's actual revoke, both see false.
Rollback restores the exact prior schema ACL, accepted routine definitions/
OIDs/security settings, role OIDs and runtime probe.

In another transaction, the probe changes only the accepted cleanup UPDATE
anchor, executes the real candidate, and expects the new explicit unknown-
cleanup-predecessor refusal. Rollback must restore the exact prior snapshot.
No altered definition is committed, and no fingerprint guard is bypassed.

## Execution evidence

The Lead granted this reviewer the exclusive synthetic DB window after the
database owner released it. Process inspection found no prior DB runner.
`loadTarget()` validates explicit mode600 credentials, branch-create receipt,
synthetic flags, exact endpoint/roles and expiry before connections. Initial
probe found zero active restricted-role transactions, writer CREATE=false and
probe OID24576. Target remains project `lucky-bar-14515304`, branch
`br-weathered-thunder-b38dgxbm`, endpoint `ep-dry-breeze-b3e8t69s`.

All commands use source `244348c519d7c1aba32334dead8c88d3abec3a27`.
API commands run from this checkout's `ourhoomu-api/` with path-only bindings:

```sh
export SYNTHETIC_DB_ENV_FILE=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/synthetic-db.env
export NEON_BRANCH_RECEIPT=/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/branch-create.json
```

Durable evidence is under
`/Users/afe/Desktop/ourhoomu/.git/ourhoomu-snapshots/core-implementation/SW-0064-correction/`.
`cleanup-lock-probe.ts` and its log preserve the executed concurrent probe;
`migration-security-probe.ts` and its log preserve the transaction/ACL/refusal
probe; `db-results.json` and per-command logs preserve source, command and exit
codes. `migration-hashes.json` records migration byte comparisons.

The interrupted review draft recorded offline install/Drizzle observations. This
resumed reviewer did not independently rerun those commands, so they are not
included in the fresh verification claim. The original independent report at
`ecc04b6b1498e81b41a7c27896d2b1e3cbcbd7ca` retains its API unit/type/format/lint,
contracts, core/session and timezone results. Those runs concern the earlier
source and are not reported as newly executed on `244348c`.

## Resumed independent execution and release

The Lead reassigned the exact checkout and exclusive guarded synthetic window.
Initial process inspection found a separate credential-free fixture Wrangler
server on port 18789; the Lead confirmed that owner had no synthetic DB
binding or DB-call authorization. Guarded read-only preflight at
`2026-10-16T10:05:31.402Z` found zero active restricted-role sessions, zero
restricted-role transactions, writer CREATE=false, runtime probe OID 24576,
and the exact corrected candidate hash already applied.

The following commands were then rerun sequentially from this exact checkout,
using the explicit env/receipt paths above. Every command exited 0. The
resumed reviewer observed completion; preserved pre-interruption results are
separate in `db-results.json`.

| Command | Fresh observed result |
| --- | --- |
| `bun <evidence>/cleanup-lock-probe.ts` | PASS 3 actual lock/convergence/physical-cleanup assertions |
| `bun scripts/db/check-http-auth.ts` | PASS 16 restricted auth-role groups; synthetic trusted-verifier claims |
| `bun scripts/db/check-http-seam.ts` | PASS 11 restricted app-role groups |
| `bun scripts/db/check-http-schema.ts` | PASS 4 actual schema/model/snapshot/RLS/TTL groups |
| `bun scripts/db/check-session-races.ts` | PASS 20 revocation, rotation and command-authority race groups |
| `bun scripts/db/check-http-seam-lifecycle.ts` | PASS 4 reapply, fingerprint refusal, occupied refusal and exact restore groups |
| `bun scripts/db/check-http-seam-migration.ts` | PASS 2 atomic rollback and unknown-predecessor groups |
| `bun <evidence>/migration-security-probe.ts` | PASS 2 transaction-local CREATE/ACL and unknown-cleanup-predecessor assertions |
| `bun scripts/db/migrate.ts patch-http-seam` | PASS; exact corrected candidate reapplied |

Fresh command/source/exit/timestamp records are `resume-results.json`; full
stdout/stderr logs are `10-resume-*.log` through `18-resume-*.log` in the same
`SW-0064-correction/` evidence directory. `09-resume-preflight.log` records the
initial state. Independent byte comparisons again confirmed accepted
migrations 0000–0002 match `6e8705e590ba7d656a2109ef0fad1e4de9cfb807` exactly.
`git diff --check` passed. No application, SQL, fixture/test or manifest changes
were authored by this reviewer.

Final guarded read-only state at `2026-10-16T10:07:17.742Z`, preserved in
`19-resume-release-state.log`, showed zero active restricted-role sessions and
zero restricted-role transactions, writer CREATE=false, runtime probe OID
24576, and preserved writer/app/auth role OIDs 41645/41647/41649. Corrected
0003 remains applied with SHA256
`940d881e9b8e03c7f048ffd68e672755dd05e25e7d41d7dc89e06600fb1b590a`.
All probe/check pools closed; process inspection found no remaining database
runner. The reviewer explicitly released the exclusive synthetic DB window
to the Lead and will make no further DB calls without reassignment. No schema
reset, role recreation, production operation or fingerprint/hash bypass was
performed.

## Acceptance boundary

This review concerns the corrected SW-0059 data seam only. It does not establish
HTTP adapter purpose/key-version encryption, native/live issuer login, SlipOK,
LINE, scheduled full purge/backup deletion or TestFlight acceptance. Those
remain their existing integration/provider/retention/release gates. Synthetic
trusted-verifier claims are not real Google/Apple authentication evidence.

Graft was used first for source context (CLI0.21.1); SQL and exact source delta
needed direct inspection. One successful retrieval receipt estimated12,093
tokens saved. No additional runtime/delegated model access is claimed.

On resume, Graft was attempted first again; the visible successful receipt
estimated 5,963 additional tokens saved. SQL delta, preserved logs and exact
assigned report required direct inspection.
