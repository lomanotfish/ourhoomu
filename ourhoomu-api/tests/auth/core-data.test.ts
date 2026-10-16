import { expect, test } from 'bun:test';
import { createApp } from '../../src/app';
import { sessionFixture } from '../fixtures/core-session';
import { transactionFixture } from '../fixtures/core-data';
import type { HttpTransaction } from '../../src/modules/core/data';
import type { components } from '@ourhoomu/contracts';

async function client(tx: HttpTransaction) {
  const fixture = await sessionFixture();
  const proof = 'n'.repeat(43);
  const challenge = await fixture.sessions.challenge(
    'google',
    proof,
    crypto.randomUUID(),
    JSON.stringify({ provider: 'google', clientNonce: proof }),
  );
  const body = {
    provider: 'google',
    challengeId: challenge.id,
    proof,
    idToken: await fixture.token(challenge.nonce),
  };
  const session = await fixture.sessions.exchange(
    'google',
    challenge.id,
    proof,
    body.idToken,
    crypto.randomUUID(),
    JSON.stringify(body),
  );
  const app = createApp(
    { appEnv: 'test', allowedOrigin: 'http://localhost:8081' },
    {
      sessions: fixture.sessions,
      data: { withPrincipal: async (_actor, work) => work(tx) },
    },
  );
  return {
    ...fixture,
    async request(path: string, method = 'GET', body?: unknown, key = crypto.randomUUID()) {
      const response = await app.fetch(
        new Request(`https://api.test/v1${path}`, {
          method,
          headers: {
            authorization: `Bearer ${session.accessToken}`,
            'content-type': 'application/json',
            'idempotency-key': key,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );
      return {
        response,
        json: (await response.json()) as { data: Record<string, unknown>; error: { code: string } },
      };
    },
  };
}

test('recipient input encrypts identifier and public DTO never includes account number, digest or ciphertext', async () => {
  const id = crypto.randomUUID();
  let stored: Record<string, unknown> = {};
  const viewer = await client(
    transactionFixture({
      command: async (op, _house, _id, input) => {
        expect(op).toBe('account.create');
        stored = input;
        return { resourceId: id, resourceKind: 'account', replayed: false, replayCiphertext: null };
      },
      ownAccount: async () => ({
        id,
        version: 1,
        bankCode: 'SCB',
        label: 'Home',
        maskedAccount: String(stored.maskedAccount),
        active: true,
        isDefault: false,
        ...stored,
      }),
    }),
  );
  const result = await viewer.request('/me/recipient-accounts', 'POST', {
    bankCode: 'SCB',
    label: 'Home',
    accountNumber: '0012345678',
  });
  expect(result.response.status).toBe(200);
  expect(result.json.data).toEqual({
    id,
    version: 1,
    bankCode: 'SCB',
    label: 'Home',
    maskedAccount: '••••5678',
    active: true,
    isDefault: false,
  });
  expect(JSON.stringify(stored)).not.toContain('0012345678');
  const plaintext = await viewer.sessions.secrets.open(
    'account-identifier',
    JSON.stringify([viewer.userId, stored.identifierDigest]),
    String(stored.identifierCiphertext),
  );
  expect(plaintext).toEqual({ accountNumber: '0012345678' });
});

test('house patch preserves timezone and expected version across the HTTP boundary', async () => {
  const id = crypto.randomUUID();
  const row = { id, name: 'Before', timezone: 'Asia/Bangkok', version: 1 };
  const viewer = await client(
    transactionFixture({
      command: async (op, houseId, _id, input) => {
        expect(op).toBe('house.update');
        expect(houseId).toBe(id);
        expect(input.expectedVersion).toBe(1);
        Object.assign(row, input, { version: 2 });
        return { resourceId: id, resourceKind: 'house', replayed: false, replayCiphertext: null };
      },
      house: async () => row,
    }),
  );
  const result = await viewer.request(`/houses/${id}`, 'PATCH', {
    name: 'After',
    timezone: 'Asia/Tokyo',
    expectedVersion: 1,
  });
  expect(result.response.status).toBe(200);
  expect(result.json.data).toEqual({ id, name: 'After', timezone: 'Asia/Tokyo', version: 2 });
  expect(
    (
      await viewer.request(`/houses/${id}`, 'PATCH', {
        name: 'After',
        timezone: 'not/a-zone',
        expectedVersion: 1,
      })
    ).response.status,
  ).toBe(400);
});

test('bank-only account update re-encrypts the existing identifier under its new bank digest', async () => {
  const id = crypto.randomUUID();
  let encrypted = '';
  let identifierDigest = '';
  let stored: Record<string, unknown> = {};
  const viewer = await client(
    transactionFixture({
      accountSecret: async () => ({
        bankCode: 'SCB',
        identifierCiphertext: encrypted,
        identifierDigest,
        keyVersion: 1,
      }),
      command: async (op, _house, accountId, input) => {
        expect(op).toBe('account.update');
        expect(accountId).toBe(id);
        stored = input;
        return { resourceId: id, resourceKind: 'account', replayed: false, replayCiphertext: null };
      },
      ownAccount: async () => ({
        id,
        version: 2,
        bankCode: 'KBANK',
        label: 'Home',
        maskedAccount: String(stored.maskedAccount),
        active: true,
        isDefault: false,
      }),
    }),
  );
  identifierDigest = await viewer.sessions.secrets.mac('account-identifier-digest', [
    'SCB',
    '0012345678',
  ]);
  encrypted = await viewer.sessions.secrets.seal(
    'account-identifier',
    JSON.stringify([viewer.userId, identifierDigest]),
    { accountNumber: '0012345678' },
  );
  const result = await viewer.request(`/me/recipient-accounts/${id}`, 'PATCH', {
    bankCode: 'KBANK',
    expectedVersion: 1,
  });
  expect(result.response.status).toBe(200);
  expect(result.json.data.maskedAccount).toBe('••••5678');
  expect(stored.identifierDigest).toBe(
    await viewer.sessions.secrets.mac('account-identifier-digest', ['KBANK', '0012345678']),
  );
  expect(stored.identifierDigest).not.toBe(identifierDigest);
  expect(stored.identifierCiphertext).not.toBe(encrypted);
  expect(JSON.stringify(stored)).not.toContain('0012345678');
  expect(
    await viewer.sessions.secrets.open(
      'account-identifier',
      JSON.stringify([viewer.userId, stored.identifierDigest]),
      String(stored.identifierCiphertext),
    ),
  ).toEqual({ accountNumber: '0012345678' });
});

test('leave consumes only the command-bound inactive snapshot and exposes no global identifier', async () => {
  const houseId = crypto.randomUUID(),
    id = crypto.randomUUID();
  const snapshot: components['schemas']['Member'] & { userId: string } = {
    id,
    displayName: 'Me',
    role: 'member',
    active: false,
    version: 4,
    removedAt: '2026-10-15T00:00:00Z',
    userId: 'private',
  };
  const viewer = await client(
    transactionFixture({
      ownMembership: async () => ({ id, version: 3 }),
      command: async (op, _house, targetId, input) => {
        expect(op).toBe('member.leave');
        expect(targetId).toBe(id);
        expect(input.expectedVersion).toBe(3);
        return {
          resourceId: id,
          resourceKind: 'membership',
          replayed: false,
          replayCiphertext: null,
          data: snapshot,
        };
      },
    }),
  );
  const result = await viewer.request(`/houses/${houseId}/leave`, 'POST');
  expect(result.response.status).toBe(200);
  expect(result.json.data).toEqual({
    id,
    displayName: 'Me',
    role: 'member',
    active: false,
    version: 4,
    removedAt: '2026-10-15T00:00:00Z',
  });
});
