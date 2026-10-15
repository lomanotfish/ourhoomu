import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from '@neondatabase/serverless';
import { CoreDatabase, SessionStore, type VerifiedPrincipal } from '../../src/db/connection';
import { loadTarget } from './target';

// Real credentials, exact disposable branch guard; never SET ROLE or timing-only assertions.
const { secrets } = loadTarget();
if (!secrets.CORE_APP_DATABASE_URL || !secrets.CORE_AUTH_DATABASE_URL)
  throw new Error('Run guarded core migration first');
const db = new CoreDatabase(secrets.CORE_APP_DATABASE_URL);
const auth = new SessionStore(secrets.CORE_AUTH_DATABASE_URL);
const owner = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 2 });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const houseInput = { name: 'SW0049 synthetic', timezone: 'Asia/Bangkok' };
const accountInput = {
  bankCode: 'TEST',
  identifierKind: 'bank_account' as const,
  identifierCiphertext: 'SW0049-synthetic-encrypted-account',
  identifierDigest: digest(randomUUID()),
  keyVersion: 1,
  label: 'SW0049 synthetic',
  maskedAccount: '***0049',
};
let checks = 0;

async function issue(subject = randomUUID()) {
  const proofDigest = digest(randomUUID());
  const accessDigest = digest(randomUUID());
  const refreshDigest = digest(randomUUID());
  const challenge = await auth.execute('challenge', { provider: 'google', proofDigest });
  await auth.execute('exchange', {
    provider: 'google',
    challengeId: challenge.challengeId,
    proofDigest,
    issuer: 'https://synthetic.invalid',
    subject,
    displayName: 'SW0049 synthetic',
    accessDigest,
    refreshDigest,
    authTime: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  return { principal: await auth.verifyAccessDigest(accessDigest), accessDigest, refreshDigest };
}

async function begin(client: PoolClient, principal?: VerifiedPrincipal) {
  await client.query('BEGIN');
  await client.query("set local statement_timeout='15s'");
  if (principal)
    await client.query(
      "select set_config('ourhoomu.user_id',$1,true),set_config('ourhoomu.session_id',$2,true)",
      [principal.userId, principal.sessionId],
    );
  return Number((await client.query('select pg_backend_pid() pid')).rows[0]?.pid);
}

async function waiting(pid: number, blocker: number) {
  const deadline = Date.now() + 8000;
  do {
    const row = (
      await owner.query(
        'select wait_event_type, $2::int=ANY(pg_blocking_pids(pid)) blocked from pg_stat_activity where pid=$1',
        [pid, blocker],
      )
    ).rows[0];
    if (row?.wait_event_type === 'Lock' && row.blocked) return;
    // Polling backs off only; success requires the observed DB blocking edge.
    await Bun.sleep(20);
  } while (Date.now() < deadline);
  throw new Error('Expected database blocking edge was not observed within 8 seconds');
}

function command(
  client: PoolClient,
  op: string,
  house: string | null,
  resource: string | null,
  input: object,
  key = digest(randomUUID()),
) {
  return client.query('select core.command($1,$2::uuid,$3::uuid,$4::jsonb,$5,$6) result', [
    op,
    house,
    resource,
    JSON.stringify(input),
    key,
    digest(JSON.stringify(input)),
  ]);
}

async function fixture(principal: VerifiedPrincipal) {
  return db.withPrincipal(principal, async (tx) => {
    const result = await tx.command('house.create', null, null, houseInput, {
      keyDigest: digest(randomUUID()),
      bodyHash: digest(JSON.stringify(houseInput)),
    });
    return result.resourceId;
  });
}

async function mutationState(user: string, house: string | null) {
  // Include durable locators/events and resource versions, excluding the intentional revocation.
  return (
    await owner.query(
      `select
    (select count(*)::int from core.houses where created_by_user_id=$1) houses,
    (select count(*)::int from core.recipient_accounts where owner_user_id=$1) accounts,
    (select coalesce(sum(version),0)::text from core.recipient_accounts where owner_user_id=$1) account_versions,
    (select count(*)::int from core.idempotency_records where actor_user_id=$1) locators,
    (select count(*)::int from core.activity_events where house_id=$2) events,
    (select coalesce(sum(version),0)::text from core.bills where house_id=$2) bill_versions,
    (select coalesce(sum(version),0)::text from core.chore_occurrences where house_id=$2) chore_versions,
    (select count(*)::int from core.chore_completion_events where house_id=$2) completions,
    (select count(*)::int from core.house_invitations where house_id=$2 and consumed_at is not null) consumed_invites`,
      [user, house],
    )
  ).rows[0];
}

// Removing the post-wait session check makes house.create/account writes or replay succeed here.
async function revokedBeforeScope(op: string, replay = false, atChild = false) {
  const { principal, accessDigest } = await issue();
  const userScoped = [
    'house.create',
    'account.create',
    'account.update',
    'account.archive',
  ].includes(op);
  const house = userScoped ? null : await fixture(principal);
  let resource: string | null = null;
  let input: object = houseInput;
  if (op.startsWith('account.')) input = accountInput;
  if (op === 'account.update' || op === 'account.archive') {
    resource = await db.withPrincipal(
      principal,
      async (tx) =>
        (
          await tx.command('account.create', null, null, accountInput, {
            keyDigest: digest(randomUUID()),
            bodyHash: digest(JSON.stringify(accountInput)),
          })
        ).resourceId,
    );
    input = { expectedVersion: 1, label: 'must not persist' };
  }
  if (op === 'house.update')
    input = { name: 'must not persist', timezone: 'Asia/Bangkok', expectedVersion: 1 };
  if (op === 'chore.create') input = { title: 'must not persist', localDate: '2026-10-20' };
  if (op === 'bill.create' || op === 'bill.update') {
    const membership = (
      await owner.query('select id from core.house_memberships where house_id=$1 and user_id=$2', [
        house,
        principal.userId,
      ])
    ).rows[0]?.id;
    input = {
      title: 'must not persist',
      totalSatang: 100,
      currency: 'THB',
      recipientMembershipId: membership,
      participants: [{ membershipId: membership, basisPoints: 10000 }],
      dueDate: '2026-10-20',
    };
    if (op === 'bill.update') {
      const setup = await db.pool.connect();
      try {
        await begin(setup, principal);
        resource = String(
          (await command(setup, 'bill.create', house, null, input)).rows[0]?.result.resourceId,
        );
        await setup.query('COMMIT');
      } finally {
        await setup.query('ROLLBACK');
        setup.release();
      }
      input = { ...input, expectedVersion: 1 };
    }
  }
  if (op === 'chore.complete') {
    const assignee = (
      await owner.query('select id from core.house_memberships where house_id=$1 and user_id=$2', [
        house,
        principal.userId,
      ])
    ).rows[0]?.id;
    resource = await db.withPrincipal(
      principal,
      async (tx) =>
        (
          await tx.command(
            'chore.create',
            house,
            null,
            {
              title: 'SW0049 synthetic',
              localDate: '2026-10-20',
              assigneeMembershipId: String(assignee),
            },
            { keyDigest: digest(randomUUID()), bodyHash: digest('synthetic chore') },
          )
        ).resourceId,
    );
    input = { expectedVersion: 1 };
  }
  if (op === 'invite.accept') {
    const tokenDigest = digest(randomUUID());
    const invitation = { tokenDigest, replayCiphertext: 'synthetic-envelope-'.repeat(4) };
    await db.withPrincipal(principal, (tx) =>
      tx.command('invite.create', house, null, invitation, {
        keyDigest: digest(randomUUID()),
        bodyHash: digest(JSON.stringify(invitation)),
      }),
    );
    input = { tokenDigest };
  }
  const key = digest(randomUUID());
  if (replay) {
    const setup = await db.pool.connect();
    try {
      await begin(setup, principal);
      await command(setup, op, house, resource, input, key);
      await setup.query('COMMIT');
    } finally {
      await setup.query('ROLLBACK');
      setup.release();
    }
  }
  const before = await mutationState(principal.userId, house);
  const lock = await owner.connect();
  const app = await db.pool.connect();
  let pending: Promise<unknown> | undefined;
  try {
    const blocker = await begin(lock);
    const childTables: Record<string, string> = {
      'account.update': 'recipient_accounts',
      'bill.update': 'bills',
      'chore.complete': 'chore_occurrences',
    };
    await lock.query(
      atChild
        ? `select id from core.${childTables[op]} where id=$1 for update`
        : house
          ? 'select id from core.houses where id=$1 for update'
          : 'select id from core.users where id=$1 for update',
      [atChild ? resource : (house ?? principal.userId)],
    );
    const pid = await begin(app, principal);
    pending = command(app, op, house, resource, input, key).then(
      (result) => ({ result }),
      (error: unknown) => ({ error }),
    );
    await waiting(pid, blocker);
    if (atChild) {
      const verifier = await auth.pool.connect();
      let revoke: Promise<{ error?: unknown }> | undefined;
      try {
        const verifierPid = await begin(verifier);
        revoke = verifier
          .query("select core.auth_command('revoke',$1::jsonb)", [
            JSON.stringify({ sessionId: principal.sessionId }),
          ])
          .then(
            () => ({}),
            (error: unknown) => ({ error }),
          );
        await waiting(verifierPid, pid);
        await lock.query('ROLLBACK');
        assert.equal(((await pending) as { error?: unknown }).error, undefined);
        await waiting(verifierPid, pid);
        await app.query('ROLLBACK');
        assert.equal((await revoke).error, undefined);
        await verifier.query('COMMIT');
        await assert.rejects(() => auth.verifyAccessDigest(accessDigest));
        assert.deepEqual(await mutationState(principal.userId, house), before);
        console.log(`PASS ${op} child wait pins authority through statement and rollback`);
        checks++;
        return;
      } finally {
        await lock.query('ROLLBACK');
        await pending;
        await app.query('ROLLBACK');
        await revoke;
        await verifier.query('ROLLBACK');
        verifier.release();
      }
    }
    await auth.execute('revoke', { sessionId: principal.sessionId });
    await assert.rejects(() => auth.verifyAccessDigest(accessDigest));
    await lock.query('ROLLBACK');
    const outcome = (await pending) as {
      result?: unknown;
      error?: { code?: string; message?: string };
    };
    assert.equal(outcome.error?.code, 'P0001', `${op} replay=${replay}: revoked command succeeded`);
    assert.equal(
      outcome.error?.message,
      userScoped || atChild || op === 'invite.accept' ? 'unauthenticated' : 'not_found',
    );
    await app.query('ROLLBACK');
    assert.deepEqual(
      await mutationState(principal.userId, house),
      before,
      'Denied command persisted mutation, event or locator',
    );
    console.log(
      `PASS committed revocation before ${op} ${atChild ? 'child' : 'scope'} lock; replay=${replay}`,
    );
    checks++;
  } finally {
    await lock.query('ROLLBACK');
    await pending;
    await app.query('ROLLBACK');
    lock.release();
    app.release();
  }
}

function rotateInput(refreshDigest: string) {
  return {
    refreshDigest,
    keyDigest: digest(randomUUID()),
    bodyHash: digest('synthetic rotation'),
    nextAccessDigest: digest(randomUUID()),
    nextRefreshDigest: digest(randomUUID()),
    replayCiphertext: 'synthetic-envelope-'.repeat(4),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
}

// FOR UPDATE on the app's user scope would block a sibling family's rotation
// FK KEY SHARE, creating a user/family inversion when rotation wins its root.
async function siblingFamilyRotation() {
  const subject = randomUUID();
  const [a, b] = [await issue(subject), await issue(subject)];
  assert.equal(a.principal.userId, b.principal.userId);
  const app = await db.pool.connect();
  const verifier = await auth.pool.connect();
  try {
    await begin(app, a.principal);
    await command(app, 'house.create', null, null, houseInput);
    await begin(verifier);
    const input = rotateInput(b.refreshDigest);
    const result = (
      await verifier.query("select core.auth_command('rotate',$1::jsonb) result", [
        JSON.stringify(input),
      ])
    ).rows[0]?.result;
    assert.equal(result.replayed, false);
    await verifier.query('COMMIT');
    await auth.verifyAccessDigest(input.nextAccessDigest);
    assert.equal((await app.query('select core.actor() actor')).rows[0]?.actor, a.principal.userId);
    console.log('PASS sibling-family rotation FK remains compatible with app user-scope lock');
    checks++;
  } finally {
    await app.query('ROLLBACK');
    await verifier.query('ROLLBACK');
    app.release();
    verifier.release();
  }
}

// Removing the family lock, taking only the current generation, or releasing it
// at statement end allows the authority mutation to commit before the app ends.
async function mutationInterval(mode: 'revoke' | 'rotate' | 'reuse' | 'app-revoke') {
  const issued = await issue();
  let principal = issued.principal;
  let accessDigest = issued.accessDigest;
  const rotation = rotateInput(issued.refreshDigest);
  if (mode === 'reuse') {
    await auth.execute('rotate', rotation);
    principal = await auth.verifyAccessDigest(rotation.nextAccessDigest);
    accessDigest = rotation.nextAccessDigest;
  }
  const app = await db.pool.connect();
  const authorityPool = new Pool({
    connectionString:
      mode === 'app-revoke' ? secrets.CORE_APP_DATABASE_URL : secrets.CORE_AUTH_DATABASE_URL,
    max: 1,
  });
  const authority = await authorityPool.connect();
  let pending: Promise<{ error?: unknown }> | undefined;
  try {
    const appPid = await begin(app, principal);
    const made = await command(app, 'house.create', null, null, houseInput);
    const house = String(made.rows[0]?.result.resourceId);
    const pid = await begin(authority, mode === 'app-revoke' ? principal : undefined);
    const input =
      mode === 'reuse'
        ? { ...rotation, keyDigest: digest(randomUUID()) }
        : mode === 'rotate'
          ? rotation
          : { sessionId: principal.sessionId };
    pending = (
      mode === 'app-revoke'
        ? command(authority, 'session.revoke', null, null, {})
        : authority.query('select core.auth_command($1,$2::jsonb) result', [
            mode === 'reuse' ? 'rotate' : mode,
            JSON.stringify(input),
          ])
    ).then(
      () => ({}),
      (error: unknown) => ({ error }),
    );
    await waiting(pid, appPid);
    // Authorization still works until the transaction releases its family lock.
    assert.equal((await app.query('select core.actor() actor')).rows[0]?.actor, principal.userId);
    await app.query('ROLLBACK');
    assert.equal((await pending).error, undefined);
    await authority.query('COMMIT');
    await assert.rejects(() => auth.verifyAccessDigest(accessDigest));
    assert.equal(
      (await owner.query('select id from core.houses where id=$1', [house])).rowCount,
      0,
    );
    console.log(
      `PASS ${mode} waits for authorized command transaction; generation=${mode === 'reuse' ? 1 : 0}`,
    );
    checks++;
  } finally {
    await app.query('ROLLBACK');
    await pending;
    await authority.query('ROLLBACK');
    app.release();
    authority.release();
    await authorityPool.end();
  }
}

// bill.publish takes its recipient-account lock after the common authority gate.
// Revocation must remain blocked while publish waits there and after it returns.
async function publishWait() {
  const { principal, accessDigest } = await issue();
  const house = await fixture(principal);
  const membership = (
    await owner.query('select id from core.house_memberships where house_id=$1 and user_id=$2', [
      house,
      principal.userId,
    ])
  ).rows[0]?.id;
  const [account, bill] = await db.withPrincipal(principal, async (tx) => {
    const a = await tx.command('account.create', null, null, accountInput, {
      keyDigest: digest(randomUUID()),
      bodyHash: digest(JSON.stringify(accountInput)),
    });
    const input = {
      title: 'SW0049 publish',
      totalSatang: 100,
      currency: 'THB' as const,
      recipientMembershipId: String(membership),
      participants: [{ membershipId: String(membership), basisPoints: 10000 }],
      dueDate: '2026-10-20',
    };
    const b = await tx.command('bill.create', house, null, input, {
      keyDigest: digest(randomUUID()),
      bodyHash: digest(JSON.stringify(input)),
    });
    return [a.resourceId, b.resourceId];
  });
  const lock = await owner.connect();
  const app = await db.pool.connect();
  const authClient = await auth.pool.connect();
  let publish: Promise<{ error?: unknown }> | undefined;
  let revoke: Promise<{ error?: unknown }> | undefined;
  try {
    const blocker = await begin(lock);
    await lock.query('select id from core.recipient_accounts where id=$1 for update', [account]);
    const appPid = await begin(app, principal);
    publish = command(app, 'bill.publish', house, bill ?? null, {
      expectedVersion: 1,
      recipientAccountId: account,
      recipientAccountVersion: 1,
    }).then(
      () => ({}),
      (error: unknown) => ({ error }),
    );
    await waiting(appPid, blocker);
    const authPid = await begin(authClient);
    revoke = authClient
      .query("select core.auth_command('revoke',$1::jsonb)", [
        JSON.stringify({ sessionId: principal.sessionId }),
      ])
      .then(
        () => ({}),
        (error: unknown) => ({ error }),
      );
    await waiting(authPid, appPid);
    await lock.query('ROLLBACK');
    assert.equal((await publish).error, undefined);
    await waiting(authPid, appPid);
    await app.query('ROLLBACK');
    assert.equal((await revoke).error, undefined);
    await authClient.query('COMMIT');
    await assert.rejects(() => auth.verifyAccessDigest(accessDigest));
    assert.equal(
      (await owner.query('select status from core.bills where id=$1', [bill])).rows[0]?.status,
      'draft',
    );
    assert.equal(
      (
        await owner.query('select bill_id from core.bill_recipient_snapshots where bill_id=$1', [
          bill,
        ])
      ).rowCount,
      0,
    );
    console.log(
      'PASS publish account wait pins authority through statement and rollback; no snapshot persisted',
    );
    checks++;
  } finally {
    await lock.query('ROLLBACK');
    await publish;
    await app.query('ROLLBACK');
    await revoke;
    await authClient.query('ROLLBACK');
    lock.release();
    app.release();
    authClient.release();
  }
}

try {
  await revokedBeforeScope('house.create');
  await revokedBeforeScope('house.create', true);
  await revokedBeforeScope('account.create');
  await revokedBeforeScope('account.update');
  await revokedBeforeScope('account.archive');
  await revokedBeforeScope('house.update');
  await revokedBeforeScope('house.update', true);
  await revokedBeforeScope('bill.create');
  await revokedBeforeScope('bill.create', true);
  await revokedBeforeScope('chore.create');
  await revokedBeforeScope('invite.accept');
  await revokedBeforeScope('account.update', false, true);
  await revokedBeforeScope('bill.update', false, true);
  await revokedBeforeScope('chore.complete', false, true);
  for (const mode of ['revoke', 'rotate', 'reuse', 'app-revoke'] as const)
    await mutationInterval(mode);
  await publishWait();
  await siblingFamilyRotation();
  console.log(`All ${checks} session race groups passed`);
} catch (error) {
  console.error('Session race check failed:', error instanceof Error ? error.message : 'unknown');
  process.exitCode = 1;
} finally {
  await Promise.all([db.close(), auth.close(), owner.end()]);
}
