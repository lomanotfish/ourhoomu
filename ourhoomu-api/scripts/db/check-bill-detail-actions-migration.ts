import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = new URL('../../drizzle/', import.meta.url);
const oldSql = readFileSync(new URL('0001_core_operations.sql', base), 'utf8');
const upSql = readFileSync(new URL('0005_bill_detail_actions.sql', base), 'utf8');
const rollbackSql = readFileSync(
  new URL('../db/sql/rollback-bill-detail-actions.sql', import.meta.url),
  'utf8',
);
const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', base), 'utf8')) as {
  entries: Array<{ idx: number; tag: string }>;
};
const before = JSON.parse(readFileSync(new URL('meta/0004_snapshot.json', base), 'utf8')) as Record<
  string,
  unknown
>;
const after = JSON.parse(readFileSync(new URL('meta/0005_snapshot.json', base), 'utf8')) as Record<
  string,
  unknown
>;
const md5 = (value: string) => createHash('md5').update(value).digest('hex');

const oldMatch = oldSql.match(
  /CREATE FUNCTION core\.bill_detail\(h uuid,bid uuid\) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS \$\$(.*?)\$\$;/s,
);
assert(oldMatch, 'accepted 0001 bill_detail definition exists');
const oldSource = oldMatch[1] ?? '';
assert.equal(md5(oldSource), '161704d41ad0681f0333a82508718a49');

let newSource = oldSource.replace(
  'DECLARE m uuid:=core.reader(h);b core.bills;masked jsonb;shares jsonb;private_account jsonb;',
  'DECLARE m uuid:=core.reader(h);b core.bills;masked jsonb;shares jsonb;private_account jsonb;asof timestamptz:=statement_timestamp();actions jsonb;',
);
newSource = newSource.replace(
  "SELECT jsonb_build_object('sourceAccountId',source_account_id,'accountVersion',account_version,'bankCode',bank_code,'identifierKind',identifier_kind,'maskedAccount',masked_account,'recipientName',recipient_name) INTO masked FROM core.bill_recipient_snapshots WHERE house_id=h AND bill_id=bid AND expires_at>clock_timestamp();",
  "SELECT jsonb_build_object('sourceAccountId',source_account_id,'accountVersion',account_version,'bankCode',bank_code,'identifierKind',identifier_kind,'maskedAccount',masked_account,'recipientName',recipient_name) INTO masked FROM core.bill_recipient_snapshots WHERE house_id=h AND bill_id=bid AND expires_at>asof;",
);
newSource = newSource.replace(
  "SELECT coalesce(jsonb_agg(to_jsonb(s)-'retention_deadline_at'||jsonb_build_object('confirmed_satang',coalesce(c.amount,0)::text,'remaining_satang',CASE WHEN s.self_covered THEN '0' ELSE (s.amount_satang-coalesce(c.amount,0))::text END)),'[]'::jsonb) INTO shares FROM core.bill_shares s LEFT JOIN LATERAL(SELECT sum(amount_satang) amount FROM core.payment_confirmations WHERE house_id=h AND bill_id=bid AND payer_membership_id=s.membership_id AND expires_at>clock_timestamp()) c ON true WHERE s.house_id=h AND s.bill_id=bid AND s.expires_at>clock_timestamp();",
  "SELECT coalesce(jsonb_agg(to_jsonb(s)-'retention_deadline_at'||jsonb_build_object('confirmed_satang',coalesce(c.amount,0)::text,'reserved_satang',coalesce(r.amount,0)::text,'remaining_satang',CASE WHEN s.self_covered THEN '0' WHEN s.amount_satang IS NULL THEN NULL ELSE (s.amount_satang-coalesce(c.amount,0))::text END)),'[]'::jsonb) INTO shares FROM core.bill_shares s LEFT JOIN LATERAL(SELECT sum(amount_satang) amount FROM core.payment_confirmations WHERE house_id=h AND bill_id=bid AND payer_membership_id=s.membership_id AND expires_at>asof) c ON true LEFT JOIN LATERAL(SELECT sum(p.amount_satang) amount FROM core.payment_attempts p JOIN core.bills parent ON parent.house_id=p.house_id AND parent.id=p.bill_id WHERE p.house_id=s.house_id AND p.bill_id=s.bill_id AND p.payer_membership_id=s.membership_id AND p.reservation_released_at IS NULL AND p.reservation_until>asof AND p.expires_at>asof AND parent.expires_at>asof) r ON true WHERE s.house_id=h AND s.bill_id=bid AND s.expires_at>asof;",
);
const oldAuth =
  ' IF b.recipient_membership_id=m OR EXISTS(SELECT 1 FROM core.bill_shares s WHERE s.house_id=h AND s.bill_id=bid AND s.membership_id=m AND NOT s.self_covered AND s.amount_satang>(SELECT coalesce(sum(c.amount_satang),0) FROM core.payment_confirmations c WHERE c.house_id=h AND c.bill_id=bid AND c.payer_membership_id=m)) THEN private_account:=core.private_destination(h,bid);END IF;';
const actions = ` actions:=jsonb_build_object(
 'canEditDraft',b.creator_membership_id=m AND b.status='draft',
 'canPublish',b.creator_membership_id=m AND b.status='draft' AND EXISTS(SELECT 1 FROM core.house_memberships r WHERE r.house_id=h AND r.id=b.recipient_membership_id AND r.state='active') AND NOT EXISTS(SELECT 1 FROM core.bill_shares s JOIN core.house_memberships x ON x.house_id=s.house_id AND x.id=s.membership_id WHERE s.house_id=h AND s.bill_id=bid AND x.state<>'active') AND EXISTS(SELECT 1 FROM core.recipient_accounts a WHERE a.owner_user_id=b.recipient_user_id AND a.state='active'),
 'canVoid',b.creator_membership_id=m AND b.status<>'voided' AND NOT EXISTS(SELECT 1 FROM core.payment_confirmations c WHERE c.house_id=h AND c.bill_id=bid),
 'canCreatePayment',b.status='open' AND b.expires_at>asof AND EXISTS(SELECT 1 FROM core.bill_shares s WHERE s.house_id=h AND s.bill_id=bid AND s.membership_id=m AND NOT s.self_covered AND s.expires_at>asof AND s.amount_satang::numeric-COALESCE((SELECT sum(c.amount_satang)::numeric FROM core.payment_confirmations c WHERE c.house_id=s.house_id AND c.bill_id=s.bill_id AND c.payer_membership_id=s.membership_id AND c.expires_at>asof),0)-COALESCE((SELECT sum(p.amount_satang)::numeric FROM core.payment_attempts p WHERE p.house_id=s.house_id AND p.bill_id=s.bill_id AND p.payer_membership_id=s.membership_id AND p.reservation_released_at IS NULL AND p.reservation_until>asof AND p.expires_at>asof),0)>0),
 'canViewRecipientAccount',b.expires_at>asof AND EXISTS(SELECT 1 FROM core.bill_recipient_snapshots x WHERE x.house_id=h AND x.bill_id=bid AND x.expires_at>asof) AND (b.recipient_membership_id=m OR EXISTS(SELECT 1 FROM core.bill_shares s WHERE s.house_id=h AND s.bill_id=bid AND s.membership_id=m AND NOT s.self_covered AND s.expires_at>asof AND s.amount_satang::numeric>COALESCE((SELECT sum(c.amount_satang)::numeric FROM core.payment_confirmations c WHERE c.house_id=h AND c.bill_id=bid AND c.payer_membership_id=m AND c.expires_at>asof),0))));
`;
newSource = newSource.replace(oldAuth, actions + oldAuth);
newSource = newSource.replace(
  "RETURN (to_jsonb(b)-'recipient_user_id'-'retention_deadline_at')||jsonb_build_object('shares',shares,'recipientAccountMasked',masked,'recipientAccountEncrypted',private_account);",
  "RETURN (to_jsonb(b)-'recipient_user_id'-'retention_deadline_at')||jsonb_build_object('shares',shares,'recipientAccountMasked',masked,'recipientAccountEncrypted',private_account,'actions',actions);",
);
assert.notEqual(newSource, oldSource, 'new function body was derived from accepted body');
assert.equal(md5(newSource), '995b2caafec89212c9409d849e1bde44');

const replacement = (sql: string) => {
  const match = sql.match(
    /CREATE OR REPLACE FUNCTION core\.bill_detail\(h uuid,bid uuid\)\s+RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS \$body\$(.*?)\$body\$;/s,
  );
  assert(match, 'guarded bill_detail replacement exists');
  return match[1] ?? '';
};
assert.equal(replacement(upSql), newSource);
assert.equal(replacement(rollbackSql), oldSource);
assert(upSql.includes(md5(oldSource)), 'apply requires the exact accepted predecessor');
assert(upSql.includes(md5(newSource)), 'apply recognizes exact reapply body');
assert(rollbackSql.includes(md5(newSource)), 'rollback requires the exact candidate body');
assert(rollbackSql.includes(md5(oldSource)), 'rollback recognizes the restored body');
for (const sql of [upSql, rollbackSql]) {
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /Refusing .*unknown .*definition/);
  assert.match(sql, /p\.oid=target_oid/);
  assert.match(sql, /p\.proowner=current_owner/);
  assert.match(sql, /p\.proacl IS NOT DISTINCT FROM current_acl/);
  assert.match(sql, /p\.proconfig IS NOT DISTINCT FROM current_config/);
  assert.match(sql, /p\.prosecdef/);
  assert.doesNotMatch(sql, /\b(?:CREATE|ALTER|DROP) TABLE\b|\bGRANT\b|\bREVOKE\b/i);
}
for (const key of [
  'canEditDraft',
  'canPublish',
  'canVoid',
  'canCreatePayment',
  'canViewRecipientAccount',
])
  assert(newSource.includes(`'${key}'`));
assert(newSource.includes("'reserved_satang',coalesce(r.amount,0)::text"));
assert(newSource.includes('p.reservation_released_at IS NULL'));
assert(newSource.includes('p.reservation_until>asof'));
assert(newSource.includes('parent.expires_at>asof'));
assert(newSource.includes('WHEN s.amount_satang IS NULL THEN NULL'));
assert(newSource.includes("'remaining_satang',CASE WHEN s.self_covered THEN '0'"));
assert(
  newSource.includes('private_account:=core.private_destination(h,bid)'),
  'existing authorized private destination call is preserved',
);
const entry = journal.entries.find((item) => item.tag === '0005_bill_detail_actions');
assert(entry, 'journal includes additive 0005');
assert.equal(entry.idx, 5);
assert.equal(after.prevId, before.id);
const { id: _afterId, prevId: _afterPrevId, ...afterSchema } = after;
const { id: _beforeId, prevId: _beforePrevId, ...beforeSchema } = before;
assert.deepEqual(
  afterSchema,
  beforeSchema,
  'function-only migration does not change Drizzle schema',
);
console.log('Bill detail actions migration guards, rollback, privacy, and metadata checks passed');
