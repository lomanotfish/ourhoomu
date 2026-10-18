import assert from 'node:assert/strict';
import { Pool } from '@neondatabase/serverless';
import {
  CoreDatabase,
  DataError,
  SessionStore,
  type CoreTransaction,
  type VerifiedPrincipal,
} from '../../src/db/connection';
import type { Commands, RequestEvidence } from '../../src/db/types';
import { loadTarget } from './target';
import {
  issueSyntheticSession,
  syntheticDigest as digest,
  syntheticEvidence as evidence,
  syntheticCiphertext,
} from './fixtures';
const { secrets } = loadTarget();
if (!secrets.CORE_AUTH_DATABASE_URL || !secrets.CORE_APP_DATABASE_URL)
  throw new Error('Migrate core first');
const auth = new SessionStore(secrets.CORE_AUTH_DATABASE_URL);
const db = new CoreDatabase(secrets.CORE_APP_DATABASE_URL);
const owner = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 2 });
let passed = 0;
const pass = (label: string) => console.log(`PASS ${++passed} ${label}`);
const denied = (work: () => Promise<unknown>, code = 'not_found') =>
  assert.rejects(work, (e: unknown) => e instanceof DataError && e.code === code);
const keys = (value: object, expected: string[]) =>
  assert.deepEqual(Object.keys(value).sort(), expected.sort());
const command = <K extends keyof Commands>(
  actor: VerifiedPrincipal,
  op: K,
  h: string | null,
  id: string | null,
  input: Commands[K],
  ev: RequestEvidence = evidence(),
) => db.withPrincipal(actor, (tx) => tx.command(op, h, id, input, ev));
const read = <T>(actor: VerifiedPrincipal, work: (tx: CoreTransaction) => Promise<T>) =>
  db.withPrincipal(actor, work);
const invite = async (actor: VerifiedPrincipal, h: string, expiresInSeconds = 604800) => {
  const input = {
    tokenDigest: digest(),
    replayCiphertext: syntheticCiphertext(),
    expiresInSeconds,
  };
  const ev = evidence();
  const result = await command(actor, 'invite.create', h, null, input, ev);
  return { input, ev, result };
};
const join = async (actor: VerifiedPrincipal, inv: Awaited<ReturnType<typeof invite>>) =>
  command(actor, 'invite.accept', null, null, { tokenDigest: inv.input.tokenDigest });
try {
  const [a, b, c, d] = await Promise.all(
    ['A', 'B', 'C', 'D'].map((label) => issueSyntheticSession(auth, `SW0059 ${label}`)),
  );
  const [house, other] = await Promise.all([
    command(a.claims, 'house.create', null, null, {
      name: 'SW0059 house',
      timezone: 'Asia/Bangkok',
    }),
    command(c.claims, 'house.create', null, null, { name: 'SW0059 other', timezone: 'UTC' }),
  ]);
  const h = house.resourceId,
    h2 = other.resourceId;
  const ib = await invite(a.claims, h);
  const joined = await join(b.claims, ib);
  assert(joined.data);
  keys(joined.data, ['id', 'displayName', 'role', 'active', 'version']);
  assert.equal(joined.data.active, true);
  assert.equal(joined.data.role, 'member');
  const mb = joined.resourceId;
  const own = await read(b.claims, (tx) => tx.ownMembership(h));
  assert.deepEqual(own, { id: mb, version: 1 });
  assert.deepEqual(await read(a.claims, (tx) => tx.targetMembership(h, mb)), own);
  await denied(() => read(b.claims, (tx) => tx.targetMembership(h, mb)), 'forbidden');
  await denied(() => read(c.claims, (tx) => tx.targetMembership(h, mb)));
  await denied(() => read(a.claims, (tx) => tx.targetMembership(h2, mb)));
  pass('own/target membership only id/version; owner/same-house enforced');
  const profile = await read(b.claims, (tx) => tx.me());
  keys(profile, ['id', 'displayName', 'houses']);
  assert.equal(profile.houses.length, 1);
  const firstHouse = profile.houses[0];
  assert(firstHouse);
  keys(firstHouse, ['id', 'name', 'timezone', 'version']);
  const projected = await read(b.claims, (tx) => tx.house(h));
  keys(projected, ['id', 'name', 'timezone', 'version']);
  assert.equal(projected.id, h);
  await denied(() => read(b.claims, (tx) => tx.house(h2)));
  await denied(() => read(c.claims, (tx) => tx.house(h)));
  const members = await read(b.claims, (tx) => tx.members(h));
  assert.equal(members.length, 2);
  for (const member of members) keys(member, ['id', 'displayName', 'role', 'active', 'version']);
  pass('profile/house/member outputs minimal; cross-house reads hidden');
  const invitation = await read(a.claims, (tx) => tx.invitation(h, ib.result.resourceId));
  keys(invitation, ['id', 'houseId', 'expiresAt', 'createdAt', 'status']);
  assert.equal(invitation.status, 'consumed');
  await denied(() => read(b.claims, (tx) => tx.invitation(h, ib.result.resourceId)), 'forbidden');
  await denied(() => read(c.claims, (tx) => tx.invitation(h, ib.result.resourceId)));
  const revoked = await invite(a.claims, h);
  await command(a.claims, 'invite.revoke', h, revoked.result.resourceId, {});
  assert.equal(
    (await read(a.claims, (tx) => tx.invitation(h, revoked.result.resourceId))).status,
    'revoked',
  );
  await denied(() => join(d.claims, revoked), 'invite_unavailable');
  pass('owner-only invitation metadata excludes digest/ciphertext; revoked token denied');
  for (const ttl of [1, 604800]) {
    const inv = await invite(a.claims, h, ttl);
    const meta = await read(a.claims, (tx) => tx.invitation(h, inv.result.resourceId));
    assert.equal(Date.parse(meta.expiresAt) - Date.parse(meta.createdAt), ttl * 1000);
    const replay = await command(a.claims, 'invite.create', h, null, inv.input, inv.ev);
    assert.equal(replay.resourceId, inv.result.resourceId);
    assert.equal(replay.replayed, true);
    assert.equal(replay.replayCiphertext, inv.input.replayCiphertext);
    const caps = (
      await owner.query(
        'select i.replay_until<=v.expires_at capped,i.expires_at<=v.expires_at child_expiry,i.retention_deadline_at<=v.retention_deadline_at child_deadline from core.idempotency_records i join core.house_invitations v on v.id=i.resource_id where v.id=$1',
        [inv.result.resourceId],
      )
    ).rows[0];
    assert.deepEqual(caps, { capped: true, child_expiry: true, child_deadline: true });
  }
  for (const ttl of [0, 604801, -1, 1.5, Number.NaN])
    await denied(() => invite(a.claims, h, ttl), 'validation_error');
  const invalid = {
    tokenDigest: digest(),
    replayCiphertext: syntheticCiphertext(),
    expiresInSeconds: undefined,
  } as unknown as Commands['invite.create'];
  await denied(() => command(a.claims, 'invite.create', h, null, invalid), 'validation_error');
  for (const expiresInSeconds of ['1', true, null]) {
    const malformed = { ...invalid, expiresInSeconds } as unknown as Commands['invite.create'];
    await denied(() => command(a.claims, 'invite.create', h, null, malformed), 'validation_error');
  }
  pass('TTL1/max7d exact timestamps, integer validation and encrypted replay/child caps');
  const expired = await invite(a.claims, h);
  await owner.query(
    "update core.house_invitations set expires_at=statement_timestamp()-interval '1 second',created_at=statement_timestamp()-interval '2 seconds',retention_deadline_at=statement_timestamp()+interval '24 hours' where id=$1",
    [expired.result.resourceId],
  );
  await denied(() => read(a.claims, (tx) => tx.invitation(h, expired.result.resourceId)));
  await denied(() => join(d.claims, expired), 'invite_unavailable');
  pass('expired invitation hidden and cannot be consumed');
  const accountInput = {
    bankCode: 'TEST',
    identifierKind: 'bank_account' as const,
    identifierCiphertext: syntheticCiphertext(),
    identifierDigest: digest(),
    keyVersion: 1,
    label: 'SW0059 account',
    maskedAccount: '***0059',
    isDefault: true,
  };
  const account = await command(a.claims, 'account.create', null, null, accountInput);
  const acc = await read(a.claims, (tx) => tx.account(account.resourceId));
  keys(acc, ['id', 'version', 'bankCode', 'label', 'maskedAccount', 'isDefault', 'active']);
  const secret = await read(a.claims, (tx) => tx.accountSecret(account.resourceId));
  keys(secret, ['bankCode', 'identifierCiphertext', 'identifierDigest', 'keyVersion']);
  for (const actor of [b, c, d]) {
    await denied(() => read(actor.claims, (tx) => tx.account(account.resourceId)));
    await denied(() => read(actor.claims, (tx) => tx.accountSecret(account.resourceId)));
    assert.deepEqual(await read(actor.claims, (tx) => tx.accounts()), []);
  }
  await command(a.claims, 'account.update', null, account.resourceId, {
    expectedVersion: 1,
    label: 'updated label',
  });
  assert.deepEqual(await read(a.claims, (tx) => tx.accountSecret(account.resourceId)), secret);
  assert.equal((await read(a.claims, (tx) => tx.account(account.resourceId))).version, 2);
  await denied(
    () =>
      command(a.claims, 'account.update', null, account.resourceId, {
        expectedVersion: 1,
        label: 'stale',
      }),
    'version_conflict',
  );
  pass('own account minimal, secrets private; partial patch preserves ciphertext/version');
  await command(a.claims, 'account.archive', null, account.resourceId, { expectedVersion: 2 });
  assert.equal((await read(a.claims, (tx) => tx.account(account.resourceId))).active, false);
  await denied(() =>
    command(a.claims, 'account.update', null, account.resourceId, {
      expectedVersion: 3,
      label: 'cannot reactivate',
    }),
  );
  await owner.query(
    "update core.recipient_accounts set archived_expires_at=statement_timestamp()-interval '1 second',archived_at=statement_timestamp()-interval '2 seconds' where id=$1",
    [account.resourceId],
  );
  await denied(() => read(a.claims, (tx) => tx.accountSecret(account.resourceId)));
  assert.deepEqual(await read(a.claims, (tx) => tx.accounts()), []);
  pass('archive remains inactive and rejects reactivation; expired archive disappears');
  for (let i = 0; i < 22; i++)
    await command(a.claims, 'house.create', null, null, {
      name: `SW0059 pagination ${i}`,
      timezone: 'UTC',
    });
  const all = await read(a.claims, (tx) => tx.me());
  assert.equal(all.houses.length, 23);
  const first = await read(a.claims, (tx) => tx.houses());
  assert.equal(first.length, 20);
  const last = first[19];
  assert(last);
  const next = await read(a.claims, (tx) => tx.houses({ cursor: last.id }));
  assert.equal(next.length, 3);
  assert.equal(new Set([...first, ...next].map((row) => row.id)).size, 23);
  const page = await read(b.claims, (tx) => tx.members(h, { limit: 1 }));
  const firstMember = page[0];
  assert(firstMember);
  const second = await read(b.claims, (tx) => tx.members(h, { limit: 1, cursor: firstMember.id }));
  assert.deepEqual(
    await read(b.claims, (tx) => tx.members(h, { limit: 1, cursor: firstMember.id.toUpperCase() })),
    second,
  );
  assert.equal(page.length, 1);
  assert.equal(second.length, 1);
  const secondMember = second[0];
  assert(secondMember);
  assert.notEqual(firstMember.id, secondMember.id);
  for (const limit of [0, 101, 1.5])
    await denied(() => read(a.claims, (tx) => tx.houses({ limit })), 'validation_error');
  await denied(() => read(a.claims, (tx) => tx.houses({ cursor: 'bad' })), 'validation_error');
  pass('list20/max100 UUIDcursor stable; /me includes all23 houses');
  const version = await read(a.claims, (tx) => tx.targetMembership(h, mb));
  await denied(
    () =>
      read(a.claims, async (tx) => {
        const prior = await tx.targetMembership(h, mb);
        // Commit another real restricted transaction after this transaction reads its snapshot.
        await command(a.claims, 'member.role', h, mb, {
          expectedVersion: prior.version,
          role: 'owner',
        });
        return tx.command('member.remove', h, mb, { expectedVersion: prior.version }, evidence());
      }),
    'version_conflict',
  );
  const removalInput = { expectedVersion: version.version + 1 };
  const removalEv = evidence();
  const removed = await read(a.claims, async (tx) => {
    const snapshot = await tx.targetMembership(h, mb);
    assert.equal(snapshot.version, 2);
    return tx.command('member.remove', h, snapshot.id, removalInput, removalEv);
  });
  assert(removed.data);
  keys(removed.data, ['id', 'displayName', 'role', 'active', 'version', 'removedAt']);
  assert.equal(removed.data.active, false);
  assert.equal(removed.data.version, 3);
  const removeRetry = await read(a.claims, async (tx) => {
    const snapshot = await tx.targetMembership(h, mb);
    return tx.command(
      'member.remove',
      h,
      snapshot.id,
      { expectedVersion: snapshot.version },
      removalEv,
    );
  });
  assert.deepEqual(removeRetry.data, removed.data);
  await denied(() => read(b.claims, (tx) => tx.ownMembership(h)));
  await denied(() => read(b.claims, (tx) => tx.house(h)));
  await denied(() => read(b.claims, (tx) => tx.members(h)));
  assert.deepEqual((await read(b.claims, (tx) => tx.me())).houses, []);
  pass('version409; removal snapshot only live owner replay; removed actor hidden');
  const toLeave = await invite(a.claims, h);
  const memberD = await join(d.claims, toLeave);
  const leaveEv = evidence();
  const leave = await read(d.claims, async (tx) => {
    const snapshot = await tx.ownMembership(h);
    return tx.command(
      'member.leave',
      h,
      snapshot.id,
      { expectedVersion: snapshot.version },
      leaveEv,
    );
  });
  assert.equal(leave.resourceId, memberD.resourceId);
  assert.equal(leave.data?.active, false);
  assert(leave.data?.removedAt);
  await denied(() => read(d.claims, (tx) => tx.ownMembership(h)));
  await denied(() =>
    command(d.claims, 'member.leave', h, memberD.resourceId, { expectedVersion: 1 }, leaveEv),
  );
  await denied(() => read(d.claims, (tx) => tx.members(h)));
  await owner.query(
    "update core.idempotency_records set replay_until=statement_timestamp()-interval '1 second' where key_digest=$1",
    [removalEv.keyDigest],
  );
  await denied(
    () => command(a.claims, 'member.remove', h, mb, removalInput, removalEv),
    'idempotency_conflict',
  );
  await owner.query('select core.clear_replay_secrets()');
  assert.equal(
    (
      await owner.query('select result_data from core.idempotency_records where key_digest=$1', [
        removalEv.keyDigest,
      ])
    ).rows[0].result_data,
    null,
  );
  pass('leave response only once; subsequent reads/retries404; removal replay5min');
  await owner.query(
    "update core.house_memberships set left_at=statement_timestamp()-interval '2 seconds',archived_expires_at=statement_timestamp()-interval '1 second' where house_id=$1 and id=$2",
    [h, mb],
  );
  await denied(() => read(a.claims, (tx) => tx.targetMembership(h, mb)));
  await auth.execute('revoke', { sessionId: a.claims.sessionId });
  await denied(() => read(a.claims, (tx) => tx.me()), 'unauthenticated');
  pass('revoked principal cannot use projections');
  console.log(`HTTP data restricted-role suite: ${passed} passed (synthetic sessions)`);
} finally {
  await Promise.all([auth.close(), db.close(), owner.end()]);
}
