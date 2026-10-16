import { issueSyntheticSession } from './fixtures';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import {
  CoreDatabase,
  SessionStore,
  type VerifiedPrincipal,
  DataError,
} from '../../src/db/connection';
import type { Commands, RequestEvidence } from '../../src/db/types';
import { loadTarget } from './target';

const { secrets } = loadTarget();
if (!secrets.CORE_APP_DATABASE_URL || !secrets.CORE_AUTH_DATABASE_URL)
  throw new Error('Run guarded core migration first');
const db = new CoreDatabase(secrets.CORE_APP_DATABASE_URL);
const auth = new SessionStore(secrets.CORE_AUTH_DATABASE_URL);
const owner = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 2 });
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
const evidence = (input: unknown, key = randomUUID()): RequestEvidence => ({
  keyDigest: digest(key),
  bodyHash: digest(JSON.stringify(input)),
});
let checks = 0;
function ok(label: string) {
  checks++;
  console.log(`PASS ${label}`);
}
async function rejects(work: () => Promise<unknown>, code: string) {
  let caught: unknown;
  try {
    await work();
  } catch (error) {
    caught = error;
  }
  assert(
    caught instanceof DataError && caught.code === code,
    `Expected ${code}; got ${caught instanceof Error ? caught.message : 'success'}`,
  );
}
async function actor(label: string) {
  return (await issueSyntheticSession(auth, label)).claims;
}
async function command<K extends keyof Commands>(
  principal: VerifiedPrincipal,
  op: K,
  h: string | null,
  id: string | null,
  p: Commands[K],
  key?: RequestEvidence,
) {
  return db.withPrincipal(principal, (tx) => tx.command(op, h, id, p, key ?? evidence(p)));
}
async function raw(principal: VerifiedPrincipal | null, sql: string, args: unknown[] = []) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (principal)
      await client.query(
        "select set_config('ourhoomu.user_id',$1,true),set_config('ourhoomu.session_id',$2,true)",
        [principal.userId, principal.sessionId],
      );
    const result = await client.query(sql, args);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
async function member(principal: VerifiedPrincipal, h: string) {
  const result = await raw(principal, 'select core.member($1::uuid) id', [h]);
  return String(result.rows[0]?.id);
}
async function invite(principal: VerifiedPrincipal, h: string) {
  const tokenDigest = digest(randomUUID());
  const p = {
    tokenDigest,
    expiresInSeconds: 604800,
    replayCiphertext: 'synthetic-envelope-'.repeat(4),
  };
  const issue = await command(principal, 'invite.create', h, null, p);
  return { ...issue, tokenDigest };
}
async function join(principal: VerifiedPrincipal, tokenDigest: string) {
  return command(principal, 'invite.accept', null, null, { tokenDigest });
}
try {
  const catalog = await owner.query(
    "select count(*)::int total,count(*) filter(where relrowsecurity and relforcerowsecurity)::int protected from pg_class where relnamespace='core'::regnamespace and relkind='r'",
  );
  assert.equal(catalog.rows[0]?.total, 23);
  assert.equal(catalog.rows[0]?.protected, 23);
  const unsafeFunctions = await owner.query(
    "select p.proname from pg_proc p join pg_roles r on r.oid=p.proowner where p.pronamespace='core'::regnamespace and (r.rolname<>'ourhoomu_core_writer' or not coalesce(p.proconfig,'{}'::text[]) @> ARRAY['search_path=pg_catalog'] or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))",
  );
  assert.equal(unsafeFunctions.rows.length, 0);
  const role = (
    await raw(
      null,
      'select current_user as role,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname=current_user',
    )
  ).rows[0];
  assert.equal(role.role, 'ourhoomu_core_app');
  for (const field of ['rolsuper', 'rolbypassrls', 'rolcreaterole', 'rolcreatedb'])
    assert.equal(role[field], false);
  assert.equal((await raw(null, 'select id from core.bills')).rows.length, 0);
  await assert.rejects(() => raw(null, 'select * from core.sessions'));
  await assert.rejects(() => raw(null, "select core.auth_command('challenge','{}'::jsonb)"));
  await assert.rejects(() => raw(null, 'set role ourhoomu_core_writer'));
  await assert.rejects(() => raw(null, "insert into core.users(display_name) values('forged')"));
  await assert.rejects(
    () =>
      raw(null, "select core.command('house.create',null,null,$1::jsonb,$2,$3)", [
        JSON.stringify({ name: 'No actor', timezone: 'Asia/Bangkok' }),
        digest('noactor'),
        digest('noactor-body'),
      ]),
    (e: unknown) =>
      !!e &&
      typeof e === 'object' &&
      'code' in e &&
      e.code === 'P0001' &&
      'message' in e &&
      e.message === 'unauthenticated',
  );
  ok(
    'actual pooled restricted app role: no actor sees no bills; no DML, verifier/bootstrap or owner role access',
  );
  const [a, b, c, d] = await Promise.all(['A', 'B', 'C', 'D'].map(actor));
  assert(a && b && c && d);
  const h1 = (
    await command(a, 'house.create', null, null, {
      name: 'Synthetic house one',
      timezone: 'Asia/Bangkok',
    })
  ).resourceId;
  const h2 = (
    await command(c, 'house.create', null, null, {
      name: 'Synthetic house two',
      timezone: 'Asia/Bangkok',
    })
  ).resourceId;
  const [ma, mc] = await Promise.all([member(a, h1), member(c, h2)]);
  const ib = await invite(a, h1);
  const mb = (await join(b, ib.tokenDigest)).resourceId;
  assert.equal((await raw(b, 'select id from core.houses')).rows.length, 1);
  assert.equal((await raw(b, 'select id from core.houses where id=$1', [h2])).rows.length, 0);
  await rejects(() => db.withPrincipal(b, (tx) => tx.dashboard(h2)), 'not_found');
  ok('two-house runtime RLS and hidden cross-house read');
  const account = (
    await command(a, 'account.create', null, null, {
      bankCode: 'TEST',
      identifierKind: 'bank_account',
      identifierCiphertext: 'synthetic-encrypted-account',
      identifierDigest: digest('synthetic-account'),
      keyVersion: 1,
      label: 'Synthetic',
      maskedAccount: '***1234',
    })
  ).resourceId;
  const draft = {
    title: '200 THB split',
    totalSatang: 20000,
    currency: 'THB' as const,
    recipientMembershipId: ma,
    participants: [
      { membershipId: ma, basisPoints: 5000 },
      { membershipId: mb, basisPoints: 5000 },
    ],
    dueDate: '2026-10-20',
  };
  for (const bps of [9999, 10001])
    await rejects(
      () =>
        command(a, 'bill.create', h1, null, {
          ...draft,
          participants: [{ membershipId: ma, basisPoints: bps }],
        }),
      'validation_error',
    );
  await rejects(
    () =>
      command(a, 'bill.create', h1, null, {
        ...draft,
        participants: [
          { membershipId: ma, basisPoints: 5000 },
          { membershipId: ma, basisPoints: 5000 },
        ],
      }),
    'validation_error',
  );
  await rejects(
    () => command(a, 'bill.create', h1, null, { ...draft, recipientMembershipId: mc }),
    'validation_error',
  );
  await rejects(
    () =>
      command(a, 'bill.create', h1, null, {
        ...draft,
        participants: [{ membershipId: mc, basisPoints: 10000 }],
      }),
    'validation_error',
  );
  assert.equal((await raw(a, 'select id from core.bills where house_id=$1', [h1])).rows.length, 0);
  ok('9999/10001 bps, duplicates, cross-house recipient/participant reject atomically');
  const bid = (await command(a, 'bill.create', h1, null, draft)).resourceId;
  await command(a, 'bill.publish', h1, bid, {
    recipientAccountId: account,
    recipientAccountVersion: 1,
    expectedVersion: 1,
  });
  const shares = (
    await raw(
      b,
      'select membership_id,amount_satang::text,self_covered from core.bill_shares where house_id=$1 and bill_id=$2',
      [h1, bid],
    )
  ).rows;
  assert.equal(shares.find((x) => x.membership_id === ma)?.self_covered, true);
  assert.equal(shares.find((x) => x.membership_id === mb)?.amount_satang, '10000');
  await rejects(
    () =>
      command(a, 'payment.reserve', h1, bid, {
        method: 'cash',
        amountSatang: 1,
        expectedVersion: 2,
      }),
    'forbidden',
  );
  ok('publish 20000 satang A/B halves; A10000 self-covered without fake credit');
  const p4000 = { method: 'cash' as const, amountSatang: 4000, expectedVersion: 2 };
  const pkey = evidence(p4000);
  const [p1, p1again] = await Promise.all([
    command(b, 'payment.reserve', h1, bid, p4000, pkey),
    command(b, 'payment.reserve', h1, bid, p4000, pkey),
  ]);
  assert.equal(p1.resourceId, p1again.resourceId);
  await rejects(
    () =>
      command(
        b,
        'payment.reserve',
        h1,
        bid,
        { ...p4000, amountSatang: 4001 },
        { ...pkey, bodyHash: digest('changed') },
      ),
    'idempotency_conflict',
  );
  const dashboardBeforeConfirmation = await db.withPrincipal(b, (tx) => tx.dashboard(h1));
  assert.equal(dashboardBeforeConfirmation.outstandingSatang, '10000');
  assert.equal(dashboardBeforeConfirmation.owedToMeSatang, '0');
  assert.equal(dashboardBeforeConfirmation.pendingSatang, '4000');
  assert(dashboardBeforeConfirmation.asOf);
  assert.equal(dashboardBeforeConfirmation.cashAwaitingDecisionCount, 0);
  const creatorDashboard = await db.withPrincipal(a, (tx) => tx.dashboard(h1));
  assert.equal(creatorDashboard.cashAwaitingDecisionCount, 1);
  assert(
    dashboardBeforeConfirmation.pendingPayments.some((payment) => payment.id === p1.resourceId),
  );
  assert(Array.isArray(dashboardBeforeConfirmation.todayChores));
  await rejects(
    () => command(b, 'cash.confirm', h1, p1.resourceId, { expectedVersion: 1 }),
    'forbidden',
  );
  const conf = { expectedVersion: 1 };
  const confkey = evidence(conf);
  const [confirmed, repeated] = await Promise.all([
    command(a, 'cash.confirm', h1, p1.resourceId, conf, confkey),
    command(a, 'cash.confirm', h1, p1.resourceId, conf, confkey),
  ]);
  assert.equal(confirmed.resourceId, repeated.resourceId);
  assert.equal(await db.withPrincipal(b, (tx) => tx.resolvePaymentHouse(p1.resourceId)), h1);
  await rejects(() => db.withPrincipal(d, (tx) => tx.paymentById(p1.resourceId)), 'not_found');
  assert.equal(
    (
      await raw(
        a,
        'select count(*)::int n from core.payment_confirmations where house_id=$1 and attempt_id=$2',
        [h1, p1.resourceId],
      )
    ).rows[0]?.n,
    1,
  );
  const dashboardAfterConfirmation = await db.withPrincipal(b, (tx) => tx.dashboard(h1));
  assert.equal(dashboardAfterConfirmation.outstandingSatang, '6000');
  assert.equal(dashboardAfterConfirmation.owedToMeSatang, '0');
  assert.equal(dashboardAfterConfirmation.pendingSatang, '0');
  assert(dashboardAfterConfirmation.asOf);
  assert.equal(dashboardAfterConfirmation.cashAwaitingDecisionCount, 0);
  assert(Array.isArray(dashboardAfterConfirmation.pendingPayments));
  assert(Array.isArray(dashboardAfterConfirmation.todayChores));
  const p2 = (
    await command(b, 'payment.reserve', h1, bid, {
      method: 'cash',
      amountSatang: 6000,
      expectedVersion: 2,
    })
  ).resourceId;
  assert.equal(
    ((await db.withPrincipal(b, (tx) => tx.dashboard(h1))) as { outstandingSatang: string })
      .outstandingSatang,
    '6000',
  );
  const race = await Promise.allSettled([
    command(a, 'cash.confirm', h1, p2, { expectedVersion: 1 }),
    command(a, 'cash.confirm', h1, p2, { expectedVersion: 1 }),
  ]);
  assert.equal(race.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(
    (
      await raw(
        a,
        'select sum(amount_satang)::text amount,count(*)::int n from core.payment_confirmations where house_id=$1 and bill_id=$2',
        [h1, bid],
      )
    ).rows[0]?.amount,
    '10000',
  );
  assert.equal(
    (await raw(a, 'select status from core.bills where house_id=$1 and id=$2', [h1, bid])).rows[0]
      ?.status,
    'settled',
  );
  await rejects(() => db.withPrincipal(b, (tx) => tx.privateDestination(h1, bid)), 'forbidden');
  ok(
    'Bcash4000+6000: pending not credit, creator-only confirm, same-key replay/concurrent distinct-key confirm no double credit, settled',
  );
  const draft2 = (await command(a, 'bill.create', h1, null, draft)).resourceId;
  await command(a, 'account.update', null, account, { expectedVersion: 1, label: 'Changed' });
  await rejects(
    () =>
      command(a, 'bill.publish', h1, draft2, {
        recipientAccountId: account,
        recipientAccountVersion: 1,
        expectedVersion: 1,
      }),
    'recipient_account_unavailable',
  );
  assert.equal(
    (await raw(a, 'select status from core.bills where id=$1', [draft2])).rows[0]?.status,
    'draft',
  );
  assert.equal(
    (await raw(a, 'select bill_id from core.bill_recipient_snapshots where bill_id=$1', [draft2]))
      .rows.length,
    0,
  );
  ok('stale account version blocks publish with no partial shares/snapshot');
  const raceBill = (await command(a, 'bill.create', h1, null, draft)).resourceId;
  const accountRace = await Promise.allSettled([
    command(a, 'bill.publish', h1, raceBill, {
      recipientAccountId: account,
      recipientAccountVersion: 2,
      expectedVersion: 1,
    }),
    command(a, 'account.update', null, account, { expectedVersion: 2, label: 'Race' }),
  ]);
  const status = (await raw(a, 'select status from core.bills where id=$1', [raceBill])).rows[0]
    ?.status;
  assert(status === 'draft' || status === 'open');
  if (status === 'draft') assert(accountRace[0]?.status === 'rejected');
  ok('account-update/publish race yields one serialized snapshot or safe account-version conflict');
  // A creator paying B is explicitly supported and audited.
  const baccount = (
    await command(b, 'account.create', null, null, {
      bankCode: 'TEST',
      identifierKind: 'bank_account',
      identifierCiphertext: 'synthetic-B-envelope',
      identifierDigest: digest('B-account'),
      keyVersion: 1,
      label: 'B',
      maskedAccount: '***9876',
    })
  ).resourceId;
  const selfBill = (
    await command(a, 'bill.create', h1, null, {
      ...draft,
      recipientMembershipId: mb,
      participants: [{ membershipId: ma, basisPoints: 10000 }],
    })
  ).resourceId;
  await command(a, 'bill.publish', h1, selfBill, {
    recipientAccountId: baccount,
    recipientAccountVersion: 1,
    expectedVersion: 1,
  });
  const selfPay = (
    await command(a, 'payment.reserve', h1, selfBill, {
      method: 'cash',
      amountSatang: 20000,
      expectedVersion: 2,
    })
  ).resourceId;
  await command(a, 'cash.confirm', h1, selfPay, { expectedVersion: 1 });
  assert.equal(
    (
      await raw(a, 'select self_confirmed from core.payment_confirmations where attempt_id=$1', [
        selfPay,
      ])
    ).rows[0]?.self_confirmed,
    true,
  );
  ok('creator-as-payer confirmation has explicit immutable self-confirmation audit');
  const token = await invite(a, h1);
  const consume = await Promise.allSettled([
    join(c, token.tokenDigest),
    join(d, token.tokenDigest),
  ]);
  assert.equal(consume.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(consume.filter((x) => x.status === 'rejected').length, 1);
  const activeInvite = await invite(a, h1);
  await join(b, activeInvite.tokenDigest);
  assert.equal(
    (
      await owner.query('select consumed_at from core.house_invitations where id=$1', [
        activeInvite.resourceId,
      ])
    ).rows[0]?.consumed_at,
    null,
  );
  ok('concurrent invite consumes once; already-active member does not consume invite');
  const ownerInvite = await invite(c, h2);
  const md = (await join(d, ownerInvite.tokenDigest)).resourceId;
  await command(c, 'member.role', h2, md, { role: 'owner', expectedVersion: 1 });
  const leave = await Promise.allSettled([
    command(c, 'member.leave', h2, null, { expectedVersion: 1 }),
    command(d, 'member.leave', h2, null, { expectedVersion: 2 }),
  ]);
  assert.equal(leave.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(
    (
      await owner.query(
        "select count(*)::int n from core.house_memberships where house_id=$1 and state='active' and role='owner'",
        [h2],
      )
    ).rows[0]?.n,
    1,
  );
  ok('concurrent last-owner leave leaves exactly one active owner');
  const chore = (
    await command(a, 'chore.create', h1, null, {
      title: 'Synthetic chore',
      localDate: '2026-10-20',
      assigneeMembershipId: mb,
    })
  ).resourceId;
  await rejects(() => command(a, 'chore.complete', h1, chore, { expectedVersion: 1 }), 'forbidden');
  const complete = evidence({ expectedVersion: 1 });
  const transitions = await Promise.all([
    command(b, 'chore.complete', h1, chore, { expectedVersion: 1 }, complete),
    command(b, 'chore.complete', h1, chore, { expectedVersion: 1 }, complete),
  ]);
  assert.equal(transitions[0]?.resourceId, transitions[1]?.resourceId);
  await command(b, 'chore.reopen', h1, chore, { expectedVersion: 2 });
  assert.equal(
    (
      await raw(
        a,
        'select count(*)::int n from core.chore_completion_events where occurrence_id=$1',
        [chore],
      )
    ).rows[0]?.n,
    2,
  );
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const rule = {
    mode: 'rotation' as const,
    timezone: 'Asia/Bangkok',
    anchorDate: today,
    startDate: today,
    interval: 'daily' as const,
    weekdays: [],
    assigneeMembershipIds: [ma, mb],
  };
  const schedule = (await command(a, 'schedule.create', h1, null, { title: 'Rotating', rule }))
    .resourceId;
  const previews = (await db.withPrincipal(a, (tx) => tx.previewSchedule(h1, rule))) as {
    occurrences: Array<{ localDate: string; assigneeMembershipId: string }>;
  };
  assert.equal(previews.occurrences.length, 14);
  assert.equal(previews.occurrences[0]?.assigneeMembershipId, ma);
  assert.equal(previews.occurrences[1]?.assigneeMembershipId, mb);
  const gen = { expectedVersion: 1, startDate: today, days: 30 };
  await Promise.all([
    command(a, 'schedule.generate', h1, schedule, gen),
    command(a, 'schedule.generate', h1, schedule, gen),
  ]);
  assert.equal(
    (
      await raw(a, 'select count(*)::int n from core.chore_occurrences where schedule_id=$1', [
        schedule,
      ])
    ).rows[0]?.n,
    30,
  );
  await rejects(
    () => command(a, 'schedule.generate', h1, schedule, { ...gen, days: 31 }),
    'validation_error',
  );
  await rejects(
    () =>
      command(a, 'schedule.create', h1, null, {
        title: 'Bad rule',
        rule: { ...rule, anchorDate: '2027-10-20' },
      }),
    'validation_error',
  );
  ok(
    'chore assignee-only complete/reopen events; preview14days, generation30days uniqueness and date-rule validation',
  );
  const scheduleRows = (
    await raw(
      a,
      'select id,local_date::text local_date,version from core.chore_occurrences where schedule_id=$1 order by local_date',
      [schedule],
    )
  ).rows;
  const futureCompleted = scheduleRows[2];
  assert(futureCompleted);
  await command(a, 'chore.complete', h1, futureCompleted.id, { expectedVersion: 1 });
  const effectiveFrom = String(scheduleRows[1]?.local_date);
  const revisedRule = { ...rule, startDate: effectiveFrom, assigneeMembershipIds: [mb, ma] };
  await command(a, 'schedule.update', h1, schedule, {
    title: 'Revised future rotation',
    expectedVersion: 1,
    effectiveFrom,
    rule: revisedRule,
  });
  await command(a, 'schedule.generate', h1, schedule, {
    expectedVersion: 2,
    startDate: effectiveFrom,
    days: 29,
  });
  assert.equal(
    (
      await raw(a, 'select status,schedule_revision from core.chore_occurrences where id=$1', [
        futureCompleted.id,
      ])
    ).rows[0]?.status,
    'completed',
  );
  assert.equal(
    (
      await raw(a, 'select schedule_revision from core.chore_occurrences where id=$1', [
        futureCompleted.id,
      ])
    ).rows[0]?.schedule_revision,
    1,
  );
  assert.equal(
    (
      await raw(a, 'select count(*)::int n from core.chore_occurrences where schedule_id=$1', [
        schedule,
      ])
    ).rows[0]?.n,
    30,
  );
  ok(
    'schedule future revision preserves completed rows and IDs while regeneration keeps schedule/date uniqueness',
  );

  // Invitation encrypted replay is five minutes; semantic issuance survives the generic24h window.
  const issuedInput = {
    tokenDigest: digest(randomUUID()),
    expiresInSeconds: 604800,
    replayCiphertext: 'synthetic-envelope-'.repeat(4),
  };
  const issuedKey = evidence(issuedInput);
  const issued = await command(a, 'invite.create', h1, null, issuedInput, issuedKey);
  const issuedReplay = await command(a, 'invite.create', h1, null, issuedInput, issuedKey);
  assert.equal(issuedReplay.resourceId, issued.resourceId);
  assert.equal(issuedReplay.replayCiphertext, issuedInput.replayCiphertext);
  await owner.query(
    "update core.idempotency_records set created_at=created_at-interval '25 hours',replay_until=created_at-interval '25 hours'+interval '5 minutes' where actor_user_id=$1 and resource_id=$2",
    [a.userId, issued.resourceId],
  );
  await rejects(
    () => command(a, 'invite.create', h1, null, issuedInput, issuedKey),
    'idempotency_conflict',
  );
  assert.equal(
    (
      await owner.query(
        'select count(*)::int n from core.house_invitations where token_digest=$1',
        [issuedInput.tokenDigest],
      )
    ).rows[0]?.n,
    1,
  );
  ok('invitation same-key encrypted replay5min and25h retry409 without second issuance');
  // Real composite foreign keys reject corruption even through migration credentials.
  await assert.rejects(
    () =>
      owner.query(
        "insert into core.bill_shares(house_id,bill_id,membership_id,basis_points,member_name,expires_at,retention_deadline_at) values($1,$2,$3,10000,'invalid',statement_timestamp()+interval '1 day',statement_timestamp()+interval '2 days')",
        [h2, bid, mc],
      ),
    (error: unknown) =>
      typeof error === 'object' && error !== null && 'code' in error && error.code === '23503',
  );
  ok('owner-level cross-house child insert rejected by composite FK, independent of runtime RLS');
  const latestAccountVersion = (
    await raw(a, 'select version from core.recipient_accounts where id=$1', [account])
  ).rows[0]?.version;
  const reserveBill = (await command(a, 'bill.create', h1, null, draft)).resourceId;
  await command(a, 'bill.publish', h1, reserveBill, {
    recipientAccountId: account,
    recipientAccountVersion: latestAccountVersion,
    expectedVersion: 1,
  });
  const reserveRace = await Promise.allSettled([
    command(b, 'payment.reserve', h1, reserveBill, {
      method: 'cash',
      amountSatang: 6000,
      expectedVersion: 2,
    }),
    command(b, 'payment.reserve', h1, reserveBill, {
      method: 'cash',
      amountSatang: 6000,
      expectedVersion: 2,
    }),
  ]);
  assert.equal(reserveRace.filter((x) => x.status === 'fulfilled').length, 1);
  const winner = reserveRace.find((x) => x.status === 'fulfilled');
  assert(winner?.status === 'fulfilled');
  const cashTime = (
    await owner.query(
      'select extract(epoch from (reservation_until-created_at)) duration from core.payment_attempts where id=$1',
      [winner.value.resourceId],
    )
  ).rows[0]?.duration;
  assert(Math.abs(Number(cashTime) - 86400) < 1);
  await command(a, 'cash.reject', h1, winner.value.resourceId, {
    expectedVersion: 1,
    reason: 'Synthetic rejection',
  });
  const transfer = (
    await command(b, 'payment.reserve', h1, reserveBill, {
      method: 'transfer',
      amountSatang: 10000,
      expectedVersion: 2,
    })
  ).resourceId;
  const transferTime = (
    await owner.query(
      'select extract(epoch from (reservation_until-created_at)) duration from core.payment_attempts where id=$1',
      [transfer],
    )
  ).rows[0]?.duration;
  assert(Math.abs(Number(transferTime) - 1800) < 1);
  await rejects(
    () => command(a, 'cash.confirm', h1, transfer, { expectedVersion: 1 }),
    'forbidden',
  );
  await command(b, 'payment.cancel', h1, transfer, { expectedVersion: 1 });
  const creditCount = (
    await owner.query('select count(*)::int n from core.payment_confirmations where bill_id=$1', [
      reserveBill,
    ])
  ).rows[0]?.n;
  assert.equal(creditCount, 0);
  // Move this synthetic parent to one minute before access expiry, then verify child/reservation caps.
  await owner.query(
    "update core.bills set created_at=statement_timestamp()-interval '364 days'+interval '1 minute',expires_at=statement_timestamp()+interval '1 minute',retention_deadline_at=statement_timestamp()+interval '24 hours 1 minute' where id=$1",
    [reserveBill],
  );
  await owner.query(
    'update core.bill_shares set created_at=(select created_at from core.bills where id=$1),expires_at=(select expires_at from core.bills where id=$1),retention_deadline_at=(select retention_deadline_at from core.bills where id=$1) where bill_id=$1',
    [reserveBill],
  );
  const capped = (
    await command(b, 'payment.reserve', h1, reserveBill, {
      method: 'cash',
      amountSatang: 10000,
      expectedVersion: 2,
    })
  ).resourceId;
  const caps = (
    await owner.query(
      'select p.reservation_until=b.expires_at reservation_capped,p.expires_at=b.expires_at expiry_capped,p.retention_deadline_at=b.retention_deadline_at deadline_capped from core.payment_attempts p join core.bills b on b.house_id=p.house_id and b.id=p.bill_id where p.id=$1',
      [capped],
    )
  ).rows[0];
  assert(caps?.reservation_capped && caps?.expiry_capped && caps?.deadline_capped);
  await command(b, 'payment.cancel', h1, capped, { expectedVersion: 1 });
  ok(
    'concurrent reservation cannot overbook; reject/cancel release, transfer stays uncredited; cash24h/transfer30min and near-expiry parent caps',
  );
  const beforeBig = await db.withPrincipal(b, (tx) => tx.dashboard(h1));
  for (let i = 0; i < 3; i++) {
    const huge = (
      await command(a, 'bill.create', h1, null, { ...draft, totalSatang: 900000000000 })
    ).resourceId;
    await command(a, 'bill.publish', h1, huge, {
      recipientAccountId: account,
      recipientAccountVersion: latestAccountVersion,
      expectedVersion: 1,
    });
  }
  const afterBig = await db.withPrincipal(b, (tx) => tx.dashboard(h1));
  assert.equal(
    BigInt(afterBig.outstandingSatang) - BigInt(beforeBig.outstandingSatang),
    1350000000000n,
  );
  ok('three legal maximum bills sum exact dashboard string1350000000000 above per-bill cap');
  // Every retry rolls back the whole command. No committed data from failed attempts survives.
  let retried = 0;
  const retryKey = evidence('bounded-retry');
  const retriedChore = await db.withPrincipal(a, async (tx) => {
    const result = await tx.command(
      'chore.create',
      h1,
      null,
      { title: 'Retry once', localDate: '2026-10-20', assigneeMembershipId: ma },
      retryKey,
    );
    if (retried++ < 1)
      throw Object.assign(new Error('synthetic serialization failure'), { code: '40001' });
    return result;
  });
  assert.equal(retried, 2);
  assert.equal(
    (
      await raw(a, 'select count(*)::int n from core.chore_occurrences where id=$1', [
        retriedChore.resourceId,
      ])
    ).rows[0]?.n,
    1,
  );
  ok(
    'bounded whole-transaction serialization retry commits one command and one idempotency locator',
  );

  const events = (
    await raw(
      a,
      'select id,created_at from core.activity_events where house_id=$1 order by created_at,id',
      [h1],
    )
  ).rows;
  const oldest = events[0],
    newest = events[events.length - 1];
  assert(oldest && newest);
  await command(a, 'activity.read', h1, null, { eventId: newest.id });
  await command(a, 'activity.read', h1, null, { eventId: oldest.id });
  assert.equal(
    (
      await raw(
        a,
        'select last_seen_id from core.activity_read_state where house_id=$1 and membership_id=$2',
        [h1, ma],
      )
    ).rows[0]?.last_seen_id,
    newest.id,
  );
  await rejects(
    () => command(a, 'activity.read', h1, null, { eventId: randomUUID() }),
    'not_found',
  );
  ok('activity read cursor accepts only visible events and never moves backwards');

  // Transaction rollback proves the command+idempotency+activity atomic boundary and no actor leakage.
  const before = (
    await raw(a, 'select count(*)::int n from core.chore_occurrences where house_id=$1', [h1])
  ).rows[0]?.n;
  await assert.rejects(() =>
    db.withPrincipal(a, async (tx) => {
      await tx.command(
        'chore.create',
        h1,
        null,
        { title: 'Rolled back', localDate: today, assigneeMembershipId: ma },
        evidence('rollback'),
      );
      throw new Error('forced rollback');
    }),
  );
  assert.equal(
    (await raw(a, 'select count(*)::int n from core.chore_occurrences where house_id=$1', [h1]))
      .rows[0]?.n,
    before,
  );
  assert.equal((await raw(null, 'select core.actor() actor')).rows[0]?.actor, null);
  assert.equal(
    (await raw(c, 'select id from core.bills where house_id=$1', [h1])).rows.length,
    consume[0]?.status === 'fulfilled'
      ? (await owner.query('select id from core.bills where house_id=$1', [h1])).rows.length
      : 0,
  );
  ok('forced rollback leaves no command data and pooled actor context does not leak');
  // Owner-only fixtures can move clock values for boundary tests, never runtime writes.
  const expBill = (await command(a, 'bill.create', h1, null, draft)).resourceId;
  await owner.query(
    "update core.bills set created_at=statement_timestamp()-interval '364 days 1 second',expires_at=statement_timestamp()-interval '1 second',retention_deadline_at=statement_timestamp()+interval '24 hours'-interval '1 second' where id=$1",
    [expBill],
  );
  await rejects(() => db.withPrincipal(b, (tx) => tx.bill(h1, expBill)), 'expired');
  assert.equal((await raw(b, 'select id from core.bills where id=$1', [expBill])).rows.length, 0);
  await rejects(() => db.withPrincipal(d, (tx) => tx.bill(h2, expBill)), 'not_found');
  // Remove B: bills still keep historical shares, but every subsequent read/replay is hidden.
  await command(a, 'member.remove', h1, mb, { expectedVersion: 1 });
  await rejects(() => db.withPrincipal(b, (tx) => tx.bill(h1, expBill)), 'not_found');
  await rejects(() => command(b, 'payment.reserve', h1, bid, p4000, pkey), 'not_found');
  assert.equal(
    (await raw(b, 'select membership_id from core.bill_shares where house_id=$1', [h1])).rows
      .length,
    0,
  );
  ok(
    'fresh membership precedes child expiry/existence/replay; expired parent and removal close RLS immediately',
  );
  const plan = await raw(
    a,
    'explain (analyze,buffers,format json) select id from core.chore_occurrences where house_id=$1 order by local_date,id limit 20',
    [h1],
  );
  assert(plan.rows.length === 1);
  ok('representative restricted-role household date query EXPLAIN ANALYZE BUFFERS succeeds');
  console.log(
    `Core synthetic database checks passed: ${checks}; runtime_probe untouched; provider/native/purge untested by design`,
  );
} catch (error) {
  console.error(
    'Core DB verification failed:',
    error instanceof DataError
      ? `${error.code} constraint=${error.constraint ?? 'none'}`
      : error instanceof Error
        ? error.message
        : 'unknown',
  );
  process.exitCode = 1;
} finally {
  await Promise.all([db.close(), auth.close(), owner.end()]);
}
