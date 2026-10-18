import assert from 'node:assert/strict';
import { Pool, type PoolClient } from '@neondatabase/serverless';
import { DataError, SessionStore } from '../../src/db/connection';
import { openReplay, sealReplay } from '../../src/db/replay';
import { loadTarget } from './target';
import {
  issueSyntheticSession,
  syntheticDigest as digest,
  syntheticEvidence as evidence,
  syntheticCiphertext,
} from './fixtures';

const { secrets } = loadTarget();
if (!secrets.CORE_AUTH_DATABASE_URL) throw new Error('Migrate core first');
const auth = new SessionStore(secrets.CORE_AUTH_DATABASE_URL);
const owner = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 3 });
const denied = (work: () => Promise<unknown>, code = 'unauthenticated') =>
  assert.rejects(work, (e: unknown) => e instanceof DataError && e.code === code);
let passed = 0;
const pass = (label: string) => console.log(`PASS ${++passed} ${label}`);
const challengeInput = () => ({
  provider: 'google' as const,
  proofDigest: digest(),
  ...evidence(),
});

async function blocked(pid: number, blocker: number) {
  const until = Date.now() + 8000;
  while (Date.now() < until) {
    const row = (
      await owner.query('select $2::int=ANY(pg_blocking_pids($1::int)) blocked', [pid, blocker])
    ).rows[0];
    if (row?.blocked) return;
    await Bun.sleep(25);
  }
  throw new Error('Expected observed database lock wait');
}

async function replayRace(
  change: (client: PoolClient, sessionId: string) => Promise<unknown>,
  label: string,
) {
  const issued = await issueSyntheticSession(auth);
  const blocker = await owner.connect();
  const reader = new Pool({ connectionString: secrets.CORE_AUTH_DATABASE_URL, max: 1 });
  const client = await reader.connect();
  try {
    await blocker.query('BEGIN');
    await change(blocker, issued.claims.sessionId);
    const blockPid = (await blocker.query('select pg_backend_pid() pid')).rows[0].pid;
    const readPid = (await client.query('select pg_backend_pid() pid')).rows[0].pid;
    const result = client
      .query('select core.auth_command($1,$2::jsonb) result', [
        'exchange',
        JSON.stringify({ ...issued.input, checkReplay: true }),
      ])
      .then(
        () => 'allowed',
        (e: { message: string }) => e.message,
      );
    await blocked(readPid, blockPid);
    await blocker.query('COMMIT');
    assert.equal(await result, 'unauthenticated');
    pass(label);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    client.release();
    await reader.end();
  }
}

try {
  const restricted = new Pool({ connectionString: secrets.CORE_AUTH_DATABASE_URL, max: 1 });
  try {
    for (const table of ['auth_request_locators', 'http_seam_migration_state'])
      await assert.rejects(
        () => restricted.query(`select * from core.${table}`),
        (e: unknown) => !!e && typeof e === 'object' && 'code' in e && e.code === '42501',
      );
    await assert.rejects(
      () => restricted.query("select core.auth_command_before_http('challenge','{}'::jsonb)"),
      (e: unknown) => !!e && typeof e === 'object' && 'code' in e && e.code === '42501',
    );
  } finally {
    await restricted.end();
  }
  pass(
    'restricted auth credential cannot read locators/reversal metadata or bypass evidence wrapper',
  );
  const input = challengeInput();
  const race = await Promise.all(Array.from({ length: 6 }, () => auth.execute('challenge', input)));
  assert.equal(new Set(race.map((r) => r.challengeId)).size, 1);
  assert.equal(race.filter((r) => !r.replayed).length, 1);
  assert(race.every((r) => r.expiresAt === race[0]?.expiresAt));
  await denied(
    () => auth.execute('challenge', { ...input, bodyHash: digest() }),
    'idempotency_conflict',
  );
  pass('concurrent challenge exact replay and changed body409');
  await denied(() => auth.execute('challenge', { ...input, proofDigest: digest() }));
  await denied(() => auth.execute('challenge', { ...input, provider: 'apple' }));
  // Missing evidence is an explicit negative fixture, never an accepted fallback.
  await denied(() => auth.execute('challenge', { ...input, keyDigest: '' }), 'validation_error');
  pass('challenge provider/proof/evidence boundaries');

  const challenge = race[0];
  assert(challenge);
  const base = {
    provider: input.provider,
    proofDigest: input.proofDigest,
    challengeId: challenge.challengeId,
    ...evidence(),
  };
  assert.deepEqual(await auth.execute('exchange', { ...base, checkReplay: true }), {
    pending: true,
  });
  const sessionsBefore = (await owner.query('select count(*)::int n from core.sessions')).rows[0].n;
  await denied(
    () =>
      auth.execute('exchange', {
        ...base,
        issuer: '',
        subject: '',
        displayName: '',
        accessDigest: digest(),
        refreshDigest: digest(),
        authTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 900000).toISOString(),
        refreshExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
        replayCiphertext: syntheticCiphertext(),
      }),
    'validation_error',
  );
  assert.equal(
    (await owner.query('select count(*)::int n from core.sessions')).rows[0].n,
    sessionsBefore,
  );
  pass('preflight creates no session; unverified empty claims cannot consume proof');

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const aad = JSON.stringify([
    base.provider,
    base.challengeId,
    base.proofDigest,
    base.keyDigest,
    base.bodyHash,
  ]);
  const tokens = { accessToken: crypto.randomUUID(), refreshToken: crypto.randomUUID() };
  const encrypted = await sealReplay(key, aad, tokens);
  const normal = {
    ...base,
    issuer: 'https://synthetic.invalid',
    subject: crypto.randomUUID(),
    displayName: 'SW0059 auth synthetic',
    accessDigest: digest(),
    refreshDigest: digest(),
    authTime: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 900000).toISOString(),
    refreshExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
    replayCiphertext: encrypted,
  };
  const exchanges = await Promise.all(
    Array.from({ length: 6 }, () => auth.execute('exchange', normal)),
  );
  assert.equal(exchanges.filter((r) => !r.replayed).length, 1);
  assert(exchanges.every((r) => r.replayCiphertext === normal.replayCiphertext));
  assert(!normal.replayCiphertext.includes(tokens.accessToken));
  assert(!normal.replayCiphertext.includes(tokens.refreshToken));
  assert.deepEqual(await openReplay(key, aad, exchanges[0]?.replayCiphertext ?? ''), tokens);
  await assert.rejects(() =>
    openReplay(
      key,
      JSON.stringify([base.provider, base.challengeId, base.proofDigest, digest(), base.bodyHash]),
      encrypted,
    ),
  );
  const principal = await auth.verifyAccessDigest(normal.accessDigest);
  assert.deepEqual(await auth.execute('exchange', { ...base, checkReplay: true }), {
    replayed: true,
    replayCiphertext: normal.replayCiphertext,
  });
  await denied(
    () => auth.execute('exchange', { ...normal, bodyHash: digest() }),
    'idempotency_conflict',
  );
  await denied(() => auth.execute('exchange', { ...normal, keyDigest: digest() }));
  await denied(() =>
    auth.execute('exchange', { ...base, proofDigest: digest(), checkReplay: true }),
  );
  await denied(() => auth.execute('exchange', { ...base, provider: 'apple', checkReplay: true }));
  pass(
    'concurrent exchange consumes once; exact encrypted replay; body409 and other key/proof/provider401',
  );
  const row = (
    await owner.query('select * from core.auth_request_locators where route=$1 and key_digest=$2', [
      'exchange',
      base.keyDigest,
    ])
  ).rows[0];
  assert(row.expires_at.getTime() - row.created_at.getTime() <= 86400000);
  assert(row.replay_until.getTime() - row.created_at.getTime() <= 300000);
  assert(!JSON.stringify(row).includes(normal.subject));
  assert(!JSON.stringify(row).includes(normal.accessDigest));
  pass(
    'anonymous locators contain bounded digests and ciphertext without identity or credential digests',
  );
  await auth.execute('revoke', { sessionId: principal.sessionId });
  await denied(() => auth.execute('exchange', { ...base, checkReplay: true }));
  await denied(() => auth.execute('exchange', normal));
  pass('logout always denies both replay paths');

  const distinct = challengeInput();
  const ch = await auth.execute('challenge', distinct);
  const n1 = {
    ...normal,
    ...distinct,
    challengeId: ch.challengeId,
    ...evidence(),
    accessDigest: digest(),
    refreshDigest: digest(),
  };
  const n2 = { ...n1, ...evidence(), accessDigest: digest(), refreshDigest: digest() };
  const outcomes = await Promise.allSettled([
    auth.execute('exchange', n1),
    auth.execute('exchange', n2),
  ]);
  assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = outcomes.find((r) => r.status === 'rejected');
  assert(
    rejected?.status === 'rejected' &&
      rejected.reason instanceof DataError &&
      rejected.reason.code === 'unauthenticated',
  );
  pass('different exchange keys racing one proof create exactly one session');

  const exp = await issueSyntheticSession(auth);
  await owner.query(
    "update core.auth_request_locators set replay_until=statement_timestamp()-interval '1 second',created_at=statement_timestamp()-interval '2 seconds',expires_at=statement_timestamp()+interval '23 hours' where route='exchange' and key_digest=$1",
    [exp.input.keyDigest],
  );
  await denied(() => auth.execute('exchange', { ...exp.input, checkReplay: true }));
  pass('exchange window boundary denies replay');
  const expired = challengeInput();
  const expiredCh = await auth.execute('challenge', expired);
  await owner.query(
    "update core.auth_challenges set expires_at=statement_timestamp()-interval '1 second',created_at=statement_timestamp()-interval '2 minutes' where id=$1",
    [expiredCh.challengeId],
  );
  await denied(() => auth.execute('challenge', expired));
  await denied(() =>
    auth.execute('exchange', { ...expired, challengeId: expiredCh.challengeId, checkReplay: true }),
  );
  pass('expired challenge cannot replay or create a session');

  const previouslyVerified = await issueSyntheticSession(auth);
  await owner.query(
    "update core.auth_challenges set expires_at=statement_timestamp()-interval '1 second',created_at=statement_timestamp()-interval '2 minutes' where id=$1",
    [previouslyVerified.input.challengeId],
  );
  assert.deepEqual(
    await auth.execute('exchange', { ...previouslyVerified.input, checkReplay: true }),
    { replayed: true, replayCiphertext: previouslyVerified.result.replayCiphertext },
  );
  pass(
    'previously verified exact retry uses bounded cached result after bootstrap challenge expiry',
  );

  const rotated = await issueSyntheticSession(auth);
  await auth.execute('rotate', {
    refreshDigest: rotated.refreshDigest,
    ...evidence(),
    nextAccessDigest: digest(),
    nextRefreshDigest: digest(),
    replayCiphertext: syntheticCiphertext(),
    expiresAt: new Date(Date.now() + 900000).toISOString(),
  });
  await denied(() => auth.execute('exchange', { ...rotated.input, checkReplay: true }));
  pass('rotated original session denies exchange replay');
  const expiredSession = await issueSyntheticSession(auth);
  await owner.query(
    "update core.sessions set expires_at=statement_timestamp()-interval '1 second',created_at=statement_timestamp()-interval '2 seconds' where id=$1",
    [expiredSession.claims.sessionId],
  );
  await denied(() => auth.execute('exchange', { ...expiredSession.input, checkReplay: true }));
  pass('expired original access session denies exchange replay');
  await replayRace(
    (c, id) =>
      c.query('select core.auth_command($1,$2::jsonb)', [
        'revoke',
        JSON.stringify({ sessionId: id }),
      ]),
    'replay waiting on family root sees committed revocation',
  );
  await replayRace(async (c, id) => {
    await c.query('select id from core.sessions where id=$1 for update', [id]);
    await c.query(
      "update core.auth_request_locators set replay_until=statement_timestamp()-interval '1 second',created_at=statement_timestamp()-interval '2 seconds',expires_at=statement_timestamp()+interval '23 hours' where session_id=$1",
      [id],
    );
  }, 'replay waiting on family root rechecks expired replay window');

  const cleanup = await issueSyntheticSession(auth);
  await owner.query(
    "update core.auth_request_locators set created_at=statement_timestamp()-interval '25 hours',expires_at=statement_timestamp()-interval '1 hour',replay_until=statement_timestamp()-interval '25 hours'+interval '1 minute' where key_digest=$1",
    [cleanup.input.keyDigest],
  );
  await owner.query(
    "update core.auth_request_locators set replay_until=statement_timestamp()-interval '1 second',created_at=statement_timestamp()-interval '2 seconds',expires_at=statement_timestamp()+interval '23 hours' where route='exchange' and key_digest=$1",
    [rotated.input.keyDigest],
  );
  await owner.query('select core.clear_replay_secrets()');
  assert.equal(
    (
      await owner.query(
        'select count(*)::int n from core.auth_request_locators where key_digest=$1',
        [cleanup.input.keyDigest],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await owner.query(
        'select replay_ciphertext from core.auth_request_locators where key_digest=$1',
        [rotated.input.keyDigest],
      )
    ).rows[0].replay_ciphertext,
    null,
  );
  pass('janitor expires anonymous locators and removes expired encrypted results');
  console.log(
    `HTTP auth restricted-role suite: ${passed} passed (synthetic trusted-verifier claims)`,
  );
} finally {
  await Promise.all([auth.close(), owner.end()]);
}
