# SW-0041 — final query-parser guard recheck

Date: 2026-10-13 (Asia/Bangkok). Verdict: **approve** for the remaining synthetic URL query-parser finding. No blocking findings remain in this focused recheck.

## Scope and provenance

- Frozen input: `a648cce9adfaa088e2bda04795697818953d6793`.
- Exact worktree: `/Users/afe/orca/workspaces/ourhoomu/sw-0041-runtime-review`; branch: `witchagorn/sw-0041-runtime-review`.
- Clean starting baseline: `d4c23de`. The Dispatch-authorized `git cherry-pick a648cce` succeeded as `02202f6036a654122f9b7c0d19b950034f18305a`. This applies frozen source; the reviewer authored no source changes. The only authored file in this Dispatch is this report.
- `git diff --exit-code a648cce HEAD -- ourhoomu-api` exited 0 with no output before and after verification, proving the reviewed API tree matches the frozen input.
- Read the prior `SW-0041-runtime-recheck.md`, project requirements/board/agent guide, installed Graft/review skills, and software-tech-lead runtime/worktree/quality guidance. The assigned ticket is absent from this review checkout; read its existing copy at `/Users/afe/Desktop/ourhoomu/docs/team/tickets/SW-0041.md`. The live Dispatch explicitly supplies the updated frozen input, focused scope and report ownership.
- Session permissions explicitly supplied: `approval_policy=never`, `sandbox_mode=danger-full-access`; no claim is made about an independently inspected Orca launch receipt.

## Remaining finding resolved

`ourhoomu-api/tests/fixtures/synthetic-target.ts:6` now permits only `sslmode` and `channel_binding`, and rejects any repeated decoded query key. `:17` rejects ports other than default/5432 and URL fragments. The existing exact endpoint/pooler label, Neon suffix, PostgreSQL scheme, expected role, password and secure SSL checks remain.

The allowlist rejects target overrides before callers construct write-capable Pools, rather than relying on differing WHATWG URL and driver interpretations. In the pinned `@neondatabase/serverless` **1.2.0** Client constructor, the two original host overrides still select alternate hosts and duplicate `sslmode=require&sslmode=disable` still yields `ssl: false`; all three are now rejected by the guard. This demonstrates that the fix closes the reproduced mismatch without assuming the driver changed.

The frozen package regressions in `tests/runtime-target.test.ts:21` cover foreign query host, duplicate insecure and secure SSL values, and query port. Independent constructor-only checks additionally covered the prefix host override, encoded keys, other target keys and accepted configurations. No `connect`, `query`, Pool, fetch, workerd or database command was used in the independent parser checks.

| Independent matrix | Actual result |
|---|---|
| 2 assigned roles × 2 direct/pooler hosts × 3 queries (`sslmode=require`, `sslmode=verify-full`, `sslmode=require&channel_binding=require`) | 12 accepted; driver host, user, database and port matched expectations, and SSL was not false |
| Query host prefix/foreign/percent-encoded key; hostaddr, port, user, password, database, dbname, ssl, sslcert, sslrootcert, sslkey, options, unexpected, empty and uppercase keys | 17 rejected |
| Duplicate insecure/secure/encoded SSL key, duplicate channel_binding, reversed insecure/secure SSL values | 5 rejected |
| Missing SSL, disabled SSL, fragment and nonstandard port | 4 rejected |

Observed original exploit outputs (synthetic placeholders only):

```json
{"name":"prefix query host","guardRejected":true,"driverHost":"ep-example-a1-attacker.c-4.ap-southeast-1.aws.neon.tech","driverSsl":{}}
{"name":"foreign query host","guardRejected":true,"driverHost":"evil.example","driverSsl":{}}
{"name":"duplicate insecure sslmode","guardRejected":true,"driverHost":"ep-example-a1.c-4.ap-southeast-1.aws.neon.tech","driverSsl":false}
{"pinnedDriver":"1.2.0","accepted":12,"rejected":26,"networkCalls":0}
```

## Checks actually run

Package commands ran in `ourhoomu-api/`; Git/Graft ran in the exact review worktree.

| Command | Observed result |
|---|---|
| `bun --version` | 1.4.3 |
| `bun install --frozen-lockfile` | exit 0; checked 61 installs across 136 packages, no changes |
| `bun run test` | exit 0; 6 pass, 0 fail, 15 expectations across 2 files |
| `bun run typecheck` | exit 0 |
| Independent `bun -` assertions using the pinned Client constructor | exit 0; 12 accepted and 26 rejected; original three mismatches reproduced and guard rejection confirmed |
| `git diff --exit-code a648cce HEAD -- ourhoomu-api` | exit 0; empty |
| `git diff --check` | exit 0 before report creation |
| Orca follow-up checks at start and verification checkpoints | successful; no messages |

Minimal reproduction of the three original parser bypasses, run from `ourhoomu-api/`:

```sh
bun - <<'JS'
import assert from 'node:assert/strict';
import { Client } from '@neondatabase/serverless';
import { assertSyntheticDbUrl } from './tests/fixtures/synthetic-target.ts';
const endpoint = 'ep-example-a1';
const host = `${endpoint}.c-4.ap-southeast-1.aws.neon.tech`;
const base = `postgresql://neondb_owner:placeholder@${host}/neondb?sslmode=require`;
for (const suffix of [
  `&host=${endpoint}-attacker.c-4.ap-southeast-1.aws.neon.tech`,
  '&host=evil.example',
  '&sslmode=disable',
]) {
  const value = base + suffix;
  assert.throws(() => assertSyntheticDbUrl(value, endpoint, 'neondb_owner'));
  const p = new Client({ connectionString: value }).connectionParameters;
  if (suffix.startsWith('&host=')) assert.notEqual(p.host, host);
  else assert.equal(p.ssl, false);
}
console.log('Original three bypasses rejected; driver mismatch reproduced without connecting');
JS
```

## Graft and limits

🌱 Graft: **ACTIVE** — CLI 0.21.1 in this exact worktree. `graft build --no-gitignore --no-ignore` exited 0 and indexed 36 files / 130 nodes; `graft ask "synthetic database URL query validation" --source --in ourhoomu-api/ -n 3` retrieved the complete guard; `graft grep 'assertSyntheticDbUrl' --in ourhoomu-api/` returned 17 hits across four files. `graft check` exited 0 with the wiring graph in sync; deep meaning summaries are not built. The two retrieval calls reported **562 + 2,101 = 2,663 estimated tokens saved**; no savings were inferred for other commands. `git check-ignore graft` confirmed the cache is ignored. Docs/config/package metadata were read directly because they are outside indexed code retrieval.

No authored source edits, source mutation experiment, DB writes, credential reads, deploy/provider actions, push, project status edits or nested agents occurred. A source mutation experiment was excluded by explicit read-only source ownership. Real workerd and Neon transaction/RLS/rollback checks were not repeated: this frozen correction changes only the guard, its tests and proof-report prose, and changes no production source or runtime configuration. Their existing evidence and limits remain in the prior recheck and SW-0038 report; this report supplies no new live-runtime evidence. Checking the driver's SSL option does not establish transport TLS behavior independently.

Approval applies only to closure of the remaining SW-0041 query-parser finding on the frozen input. The Lead owns integration, acceptance/status updates and cleanup; this review does not accept full domain foundation or production release.
