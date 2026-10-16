# SW-0063 private destination AAD seam

## Purpose

The accepted bill detail wire includes authorized encrypted recipient account
fields. The account decryption AAD also requires the owner user ID and the
identifier digest frozen when the bill was published. The existing restricted
`core.private_destination(uuid,uuid)` projection returned the frozen ciphertext
but omitted those two values, so the server could not decrypt that accepted
wire shape without an unsafe lookup to the mutable account row.

## Change prepared

Add migration `0004_private_destination_aad` to replace only the body of
`core.private_destination(uuid,uuid)`. It appends `ownerUserId` from the frozen
`bill_recipient_snapshots.recipient_user_id` and `identifierDigest` from the
same snapshot row. Membership lookup, hidden-not-found behavior, bill lookup,
live bill expiry, recipient-or-currently-owing-payer authorization, and live
snapshot expiry remain unchanged. The function reads no mutable account row;
there are no table, column, index, role, or grant changes. Accepted migrations
0000–0003 remain untouched.

The internal `EncryptedDestination` type includes these server-only values.
The public OpenAPI `RecipientPrivate` shape is unchanged (`bankCode`,
`accountNumber`, and `accountName`); the new fields must not be serialized into
the DTO or returned to a non-authorized viewer.

Apply and rollback are guarded by exact old/new `prosrc` MD5 fingerprints,
signature and `SECURITY DEFINER`/`search_path` checks. `CREATE OR REPLACE`
preserves the function OID, owner, and ACL, which the migration verifies after
replacement. Reapply is a no-op only for the recognized new definition;
rollback restores the exact accepted definition only from the recognized new
definition. Unknown definitions fail closed. Both operations take a
transaction-scoped advisory lock. The Drizzle journal and function-only
snapshot are added for fresh migration sequences; the guarded patch/rollback
modes cover an already-created synthetic core.

## Acceptance prepared

The restricted synthetic read-parity suite now checks recipient access and an
owing payer's access, denial for a non-owing member and nonmember, exact
internal AAD fields, no AAD field in bill list projections, frozen ciphertext
and digest after mutating the recipient account, and expiry denial. It has not
been run against the database after these changes.

## Verification

Offline checks passed:

- `cd ourhoomu-api && bun run format:check`
- `cd ourhoomu-api && bun run typecheck`
- `cd ourhoomu-api && bun run lint`
- `cd ourhoomu-api && bun test tests` — 67 passed, 0 failed, 110 assertions
- `cd ourhoomu-api && bun scripts/db/check-private-destination-aad-migration.ts`
- `cd ourhoomu-api && bunx drizzle-kit check` — journal/snapshot check passed
- `git diff --check`

No database calls or migration application were made. Restricted-role
acceptance, apply/reapply, and rollback remain NOT VERIFIED until independent
security review and an explicit synthetic DB window.
