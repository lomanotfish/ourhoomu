import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const oldSql = readFileSync(
  new URL('../../drizzle/0001_core_operations.sql', import.meta.url),
  'utf8',
);
const upSql = readFileSync(
  new URL('../../drizzle/0004_private_destination_aad.sql', import.meta.url),
  'utf8',
);
const rollbackSql = readFileSync(
  new URL('./sql/rollback-private-destination-aad.sql', import.meta.url),
  'utf8',
);
const journal = JSON.parse(
  readFileSync(new URL('../../drizzle/meta/_journal.json', import.meta.url), 'utf8'),
) as { entries: Array<{ idx: number; tag: string }> };
const priorSnapshot = JSON.parse(
  readFileSync(new URL('../../drizzle/meta/0003_snapshot.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const currentSnapshot = JSON.parse(
  readFileSync(new URL('../../drizzle/meta/0004_snapshot.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

const digest = (value: string) => createHash('md5').update(value).digest('hex');
const oldFunction = oldSql.match(
  /CREATE FUNCTION core\.private_destination\(h uuid,bid uuid\) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS \$\$(.*?)\$\$;/s,
);
assert(oldFunction, 'accepted 0001 private_destination definition exists');
const frozenAadReturn =
  " RETURN (SELECT jsonb_build_object('bankCode',s.bank_code,'identifierKind',s.identifier_kind,'identifierCiphertext',s.identifier_ciphertext,'keyVersion',s.key_version,'recipientName',s.recipient_name,'ownerUserId',s.recipient_user_id,'identifierDigest',s.identifier_digest) FROM core.bill_recipient_snapshots s WHERE s.house_id=h AND s.bill_id=bid AND s.expires_at>clock_timestamp());";
const newSource = oldFunction[1]?.replace(
  " RETURN (SELECT jsonb_build_object('bankCode',bank_code,'identifierKind',identifier_kind,'identifierCiphertext',identifier_ciphertext,'keyVersion',key_version,'recipientName',recipient_name) FROM core.bill_recipient_snapshots WHERE house_id=h AND bill_id=bid AND expires_at>clock_timestamp());",
  frozenAadReturn,
);
assert(newSource && newSource !== oldFunction[1], 'new source differs only by frozen AAD return');

const extractReplacement = (sql: string) => {
  const match = sql.match(
    /CREATE OR REPLACE FUNCTION core\.private_destination\(h uuid,bid uuid\)\s+RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS \$body\$(.*?)\$body\$;/s,
  );
  assert(match, 'guarded replacement definition exists');
  return match[1] ?? '';
};
assert.equal(extractReplacement(upSql), newSource);
assert.equal(extractReplacement(rollbackSql), oldFunction[1]);
assert(upSql.includes(digest(oldFunction[1] ?? '')));
assert(upSql.includes(digest(newSource)));
assert(rollbackSql.includes(digest(newSource)));
assert(rollbackSql.includes(digest(oldFunction[1] ?? '')));
for (const sql of [upSql, rollbackSql]) {
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /Refusing .*unknown private_destination definition/);
  assert.match(sql, /p\.proowner=current_owner/);
  assert.match(sql, /p\.proacl IS NOT DISTINCT FROM current_acl/);
  assert.match(sql, /p\.proconfig IS NOT DISTINCT FROM current_config/);
  assert.doesNotMatch(sql, /\b(?:CREATE|ALTER|DROP) TABLE\b|\bGRANT\b|\bREVOKE\b/i);
}

const migrationEntry = journal.entries.find(
  (entry) => entry.tag === '0004_private_destination_aad',
);
assert(migrationEntry, 'journal includes additive 0004');
assert.equal(migrationEntry.idx, 4);
assert.equal(currentSnapshot.prevId, priorSnapshot.id);
const { id: _currentId, prevId: _previousId, ...currentSchema } = currentSnapshot;
const { id: _priorId, prevId: _priorPreviousId, ...priorSchema } = priorSnapshot;
assert.deepEqual(
  currentSchema,
  priorSchema,
  'function-only migration does not change Drizzle schema',
);

console.log('Private destination AAD migration guards, rollback and metadata checks passed');
