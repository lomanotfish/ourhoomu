import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { SessionStore, CoreDatabase, DataError } from '../../src/db/connection';
import { loadTarget } from './target';
const { secrets } = loadTarget();
if (!secrets.CORE_AUTH_DATABASE_URL || !secrets.CORE_APP_DATABASE_URL)
  throw new Error('Migrate core first');
const store = new SessionStore(secrets.CORE_AUTH_DATABASE_URL);
const db = new CoreDatabase(secrets.CORE_APP_DATABASE_URL);
const owner = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 1 });
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
async function issue() {
  const proofDigest = digest(randomUUID());
  const ch = await store.execute('challenge', { provider: 'google', proofDigest });
  const accessDigest = digest(randomUUID()),
    refreshDigest = digest(randomUUID());
  const p = {
    provider: 'google',
    challengeId: ch.challengeId,
    proofDigest,
    issuer: 'https://synthetic.invalid',
    subject: randomUUID(),
    displayName: 'Synthetic session',
    accessDigest,
    refreshDigest,
    authTime: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  const claims = await store.execute('exchange', p);
  await assert.rejects(() => store.execute('exchange', p));
  return { claims, accessDigest, refreshDigest };
}
async function denied(work: () => Promise<unknown>) {
  await assert.rejects(
    work,
    (e: unknown) => e instanceof DataError && e.code === 'unauthenticated',
  );
}
try {
  const initial = await issue();
  const principal = await store.verifyAccessDigest(initial.accessDigest);
  const nextAccessDigest = digest(randomUUID());
  const nextRefreshDigest = digest(randomUUID());
  const input = {
    refreshDigest: initial.refreshDigest,
    keyDigest: digest(randomUUID()),
    bodyHash: digest('body'),
    nextAccessDigest,
    nextRefreshDigest,
    replayCiphertext: 'synthetic-authenticated-envelope-'.repeat(3),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
  const race = await Promise.all([store.execute('rotate', input), store.execute('rotate', input)]);
  assert.equal(race.filter((x) => x.replayed === false).length, 1);
  assert.equal(race.filter((x) => x.replayed === true).length, 1);
  assert.equal(race[0]?.replayCiphertext, race[1]?.replayCiphertext);
  await denied(() => store.verifyAccessDigest(initial.accessDigest));
  await denied(() => db.withPrincipal(principal, (tx) => tx.houses()));
  await store.verifyAccessDigest(nextAccessDigest);
  await denied(() => store.execute('rotate', { ...input, keyDigest: digest('different-key') }));
  await denied(() => store.verifyAccessDigest(nextAccessDigest));
  await denied(() => store.execute('rotate', input));
  console.log(
    'PASS single-use challenge, concurrent exact refresh converges, old access denied, different reuse revokes family and overrides replay',
  );
  const logout = await issue();
  const logoutInput = {
    ...input,
    refreshDigest: logout.refreshDigest,
    keyDigest: digest(randomUUID()),
    nextAccessDigest: digest(randomUUID()),
    nextRefreshDigest: digest(randomUUID()),
  };
  const logoutRace = await Promise.allSettled([
    store.execute('rotate', logoutInput),
    store.execute('revoke', { sessionId: logout.claims.sessionId }),
  ]);
  assert(logoutRace[1]?.status === 'fulfilled');
  await denied(() => store.verifyAccessDigest(logoutInput.nextAccessDigest));
  await denied(() => store.execute('rotate', logoutInput));
  console.log('PASS logout wins against exact refresh replay and concurrent rotation');
  const expired = await issue();
  const expInput = {
    ...input,
    refreshDigest: expired.refreshDigest,
    keyDigest: digest(randomUUID()),
    nextAccessDigest: digest(randomUUID()),
    nextRefreshDigest: digest(randomUUID()),
  };
  await store.execute('rotate', expInput);
  await owner.query(
    "update core.sessions set replay_until=statement_timestamp()-interval '1 second' where id=$1",
    [expired.claims.sessionId],
  );
  await denied(() => store.execute('rotate', expInput));
  await denied(() => store.verifyAccessDigest(expInput.nextAccessDigest));
  console.log('PASS refresh replay after5min window fails and persists family revocation');
  const live = await issue();
  const expPrincipal = await store.verifyAccessDigest(live.accessDigest);
  await owner.query(
    "update core.sessions set expires_at=statement_timestamp()-interval '1 second',created_at=statement_timestamp()-interval '2 minutes' where id=$1",
    [live.claims.sessionId],
  );
  await denied(() => db.withPrincipal(expPrincipal, (tx) => tx.houses()));
  console.log('PASS expired session cannot establish transaction actor');
} catch (error) {
  console.error('Session DB check failed:', error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
} finally {
  await Promise.all([store.close(), db.close(), owner.end()]);
}
