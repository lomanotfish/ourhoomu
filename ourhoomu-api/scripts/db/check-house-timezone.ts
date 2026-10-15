import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  CoreDatabase,
  SessionStore,
  DataError,
  type VerifiedPrincipal,
} from '../../src/db/connection';
import type { Commands, RequestEvidence } from '../../src/db/types';
import { loadTarget } from './target';

const { secrets } = loadTarget();
const db = new CoreDatabase(secrets.CORE_APP_DATABASE_URL ?? '');
const auth = new SessionStore(secrets.CORE_AUTH_DATABASE_URL ?? '');
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const evidence = (input: unknown): RequestEvidence => ({
  keyDigest: digest(randomUUID()),
  bodyHash: digest(JSON.stringify(input)),
});
let checks = 0;
function pass(label: string) {
  checks++;
  console.log(`PASS ${label}`);
}
async function actor() {
  const proofDigest = digest(randomUUID());
  const accessDigest = digest(randomUUID());
  const challenge = await auth.execute('challenge', { provider: 'google', proofDigest });
  await auth.execute('exchange', {
    provider: 'google',
    challengeId: challenge.challengeId,
    proofDigest,
    issuer: 'https://synthetic.invalid',
    subject: randomUUID(),
    displayName: 'Timezone synthetic',
    accessDigest,
    refreshDigest: digest(randomUUID()),
    authTime: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  return auth.verifyAccessDigest(accessDigest);
}
function command<K extends keyof Commands>(
  actor: VerifiedPrincipal,
  op: K,
  house: string | null,
  id: string | null,
  input: Commands[K],
  key = evidence(input),
) {
  return db.withPrincipal(actor, (tx) => tx.command(op, house, id, input, key));
}
async function read(actor: VerifiedPrincipal, sql: string, args: unknown[] = []) {
  // Match the existing restricted-role readback helper; no owner connection.
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "select set_config('ourhoomu.user_id',$1,true),set_config('ourhoomu.session_id',$2,true)",
      [actor.userId, actor.sessionId],
    );
    const result = await client.query(sql, args);
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
async function rejects(work: () => Promise<unknown>, code: string) {
  await assert.rejects(work, (error: unknown) => error instanceof DataError && error.code === code);
}

try {
  const owner = await actor();
  const member = await actor();
  assert.equal((await read(owner, 'select current_user role'))[0]?.role, 'ourhoomu_core_app');
  const house = (
    await command(owner, 'house.create', null, null, {
      name: 'Before timezone patch',
      timezone: 'Asia/Bangkok',
    })
  ).resourceId;
  const membership = String((await read(owner, 'select core.member($1::uuid) id', [house]))[0]?.id);
  const tokenDigest = digest(randomUUID());
  await command(owner, 'invite.create', house, null, {
    tokenDigest,
    replayCiphertext: 'synthetic-timezone-envelope-'.repeat(4),
  });
  await command(member, 'invite.accept', null, null, { tokenDigest });
  const memberId = String((await read(member, 'select core.member($1::uuid) id', [house]))[0]?.id);
  const day = '2026-10-20';
  const rule = {
    mode: 'repeat' as const,
    timezone: 'Asia/Bangkok',
    anchorDate: day,
    startDate: day,
    interval: 'daily' as const,
    weekdays: [],
    assigneeMembershipIds: [membership],
  };
  const schedule = (
    await command(owner, 'schedule.create', house, null, { title: 'Frozen Bangkok rule', rule })
  ).resourceId;
  await command(owner, 'schedule.generate', house, schedule, {
    expectedVersion: 1,
    startDate: day,
    days: 2,
  });
  const snapshots = async () => ({
    revisions: await read(
      owner,
      'select * from core.chore_revisions where schedule_id=$1 order by revision',
      [schedule],
    ),
    occurrences: await read(
      owner,
      'select * from core.chore_occurrences where schedule_id=$1 order by local_date',
      [schedule],
    ),
  });
  const before = await snapshots();
  const state = async () =>
    (await read(owner, 'select name,timezone,version from core.houses where id=$1', [house]))[0];
  assert.deepEqual(await state(), {
    name: 'Before timezone patch',
    timezone: 'Asia/Bangkok',
    version: 1,
  });
  const input = { name: 'After timezone patch', timezone: 'America/New_York', expectedVersion: 1 };
  const key = evidence(input);
  const changed = await command(owner, 'house.update', house, null, input, key);
  assert.equal(changed.replayed, false);
  assert.deepEqual(await state(), {
    name: 'After timezone patch',
    timezone: 'America/New_York',
    version: 2,
  });
  pass('restricted owner updates name/timezone/version atomically');
  assert.deepEqual(await snapshots(), before);
  pass('house patch preserves every saved schedule revision and occurrence field');
  const replay = await command(owner, 'house.update', house, null, input, key);
  assert.equal(replay.replayed, true);
  assert.equal(replay.resourceId, house);
  const updated = await state();
  assert.equal(updated?.version, 2);
  pass('exact retry returns same locator with one version increment');
  await rejects(
    () =>
      command(
        owner,
        'house.update',
        house,
        null,
        { ...input, timezone: 'Europe/London' },
        { ...key, bodyHash: digest('different body') },
      ),
    'idempotency_conflict',
  );
  assert.deepEqual(await state(), updated);
  pass('changed retry body cannot mutate house');
  for (const timezone of ['Not/A_Timezone', '', null, undefined]) {
    const invalid = { name: 'Must not persist', timezone, expectedVersion: 2 };
    // Deliberately bypass the typed boundary to exercise missing/null SQL input validation.
    await rejects(
      () => command(owner, 'house.update', house, null, invalid as Commands['house.update']),
      'validation_error',
    );
    assert.deepEqual(await state(), updated);
  }
  pass('invalid/empty/null/missing timezone cannot partially update name or version');
  await rejects(
    () =>
      command(owner, 'house.update', house, null, {
        ...input,
        name: 'Stale write',
        timezone: 'Europe/London',
      }),
    'version_conflict',
  );
  assert.deepEqual(await state(), updated);
  pass('stale expectedVersion preserves all house fields');
  await rejects(
    () => command(member, 'house.update', house, null, { ...input, expectedVersion: 2 }),
    'forbidden',
  );
  assert.deepEqual(await state(), updated);
  pass('nonowner cannot update house');
  await rejects(
    () => command(owner, 'schedule.create', house, null, { title: 'Wrong old zone', rule }),
    'validation_error',
  );
  const nextSchedule = (
    await command(owner, 'schedule.create', house, null, {
      title: 'Current New York rule',
      rule: { ...rule, timezone: 'America/New_York' },
    })
  ).resourceId;
  assert.equal(
    (
      await read(owner, 'select timezone from core.chore_revisions where schedule_id=$1', [
        nextSchedule,
      ])
    )[0]?.timezone,
    'America/New_York',
  );
  pass('new rules require and save current house timezone');
  await command(owner, 'schedule.generate', house, schedule, {
    expectedVersion: 1,
    startDate: '2026-10-22',
    days: 1,
  });
  const generated = await read(
    owner,
    'select local_date::text,timezone from core.chore_occurrences where schedule_id=$1 order by local_date',
    [schedule],
  );
  assert.deepEqual(
    generated,
    [20, 21, 22].map((day) => ({ local_date: `2026-10-${day}`, timezone: 'Asia/Bangkok' })),
  );
  pass('generation from existing rule retains saved zone and local dates');
  await command(owner, 'member.role', house, memberId, { expectedVersion: 1, role: 'owner' });
  await command(member, 'member.remove', house, membership, { expectedVersion: 1 });
  await rejects(() => command(owner, 'house.update', house, null, input, key), 'not_found');
  await rejects(
    () => command(owner, 'house.update', house, null, { ...input, expectedVersion: 2 }),
    'not_found',
  );
  assert.deepEqual(
    (await read(member, 'select name,timezone,version from core.houses where id=$1', [house]))[0],
    updated,
  );
  pass('removed owner cannot replay or submit fresh patch and causes no mutation');
  console.log(`${checks} restricted-role synthetic house timezone checks passed`);
} finally {
  await db.close();
  await auth.close();
}
