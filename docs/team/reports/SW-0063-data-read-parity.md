# SW-0063 data read parity

## Current checkpoint

The first required correction is the `clear_replay_secrets` lock order in the
unaccepted `0003_http_seam.sql` candidate. Accepted migration history `0000`–
`0002` remains unchanged. The old candidate SHA-256 was
`1ce60b914ef2fd08edbe6fe2de52e53458433fc92b4c82fc628f8907adca20a4`; the
corrected candidate SHA-256 is
`940d881e9b8e03c7f048ffd68e672755dd05e25e7d41d7dc89e06600fb1b590a`.

Result pruning now shares the existing final `idempotency_records` update,
which runs after the family-root lock loop. Its exact predecessor anchor must
occur once or the candidate refuses to apply. The update clears only expired
replay data, including legacy rows whose replay deadline is null, without
updating null-deadline rows that have no result payload. This keeps the command
lock order (family root, then idempotency row) consistent with the janitor.

The lifecycle fixture now ages `replay_until` to
`least(created_at + 5 minutes, statement_timestamp() - 1 second)` without
rewriting `created_at`, preserving `idempotency_valid` for old fixtures.

## Verification

Using the guarded mode-600 synthetic credentials and branch receipt documented
in `ourhoomu-api/README.md`:

- `bun scripts/db/check-http-seam-migration.ts` — passed transactional rollback
  and unknown-predecessor refusal.
- `bun scripts/db/migrate.ts patch-http-seam` — applied corrected candidate;
  reported SHA-256 `940d881e9b8e03c7f048ffd68e672755dd05e25e7d41d7dc89e06600fb1b590a`.
- `bun scripts/db/check-http-auth.ts` — 16 restricted auth checks passed.
- `bun scripts/db/check-http-seam.ts` — 11 restricted data checks passed.
- `bun scripts/db/check-http-schema.ts` — exit code 0.
- `bun scripts/db/check-http-seam-lifecycle.ts` — reapply no-op, drift refusal,
  occupied rollback refusal, and exact unoccupied rollback passed.
- Reapplied corrected `0003_http_seam.sql` after lifecycle rollback.

The first apply attempt failed with SQLSTATE `42601` because the new PL/pgSQL
anchor variables were undeclared. It rolled back transactionally. The variables
were declared, the migration rollback/refusal check passed, and the corrected
candidate then applied successfully.

The independent security reviewer still needs to recheck the corrected source
and lock-order behavior. SW-0063 read projections and their acceptance tests are
not implemented at this checkpoint.

## Read parity implementation checkpoint — 2026-10-16

The current isolated implementation adds paginated bills, payment summaries,
chores and activity reads, recipient-scoped account selection, and the expanded
dashboard projection in `src/db/connection.ts`. `CorePage<T>` is
`{ items: T[]; nextCursor: UUID | null }`; each cursor is the final item's ID,
while SQL resolves the row's stable ordering tuple (`created_at,id` for bills,
payments and activity; `local_date,id` for chores). This preserves the frozen
wire envelope's UUID-shaped `nextCursor` while following the OpenAPI ordering
contract. Limits remain 20 by default and 100 maximum. Activity summaries expose
only event kind and related chore/bill title; they do not include account,
payment-provider or slip details. Bill totals bounded by MAX_SATANG are JSON
integers; cross-house dashboard totals remain exact decimal strings.

The schedule list/detail implementation is gated by a contract mismatch. The
OpenAPI `ChoreSchedule.expiresAt` is required and non-null, but the accepted
schema has no active schedule expiry: `chore_schedules` is current state, and
only superseded revisions have `archive_expires_at`. Current domain policy also
classifies active schedules as current state. No expiry mapping has been
invented. Lead is obtaining the user's decision; schedule methods and the final
domain interface remain pending that answer.

Verification completed offline in this worktree:

- `bun install --frozen-lockfile` — completed with Bun 1.4.3.
- `bun run typecheck` — passed.
- `bun test tests` — 67 passed, 0 failed (110 assertions).
- `bun run format:check` — initially reported the required formatting change;
  `bunx biome format --write src/db/connection.ts` applied it.
- `bun run lint` — initially reported the two unused imports; they were removed.
- Restricted-role checks have not run for this checkpoint. The Lead's
  synthetic database window is currently withheld pending the real HTTP handler
  acceptance step. No database commands were run from this worktree.

Required next step: once the Lead grants a restricted synthetic DB window, run
read parity acceptance for list ordering/cursors and limits, expiry and
cross-house hiding, payment privacy, recipient account selector scope, exact
dashboard totals/local date, and activity privacy. Schedule acceptance stays
blocked until the required `expiresAt` mapping is resolved.
