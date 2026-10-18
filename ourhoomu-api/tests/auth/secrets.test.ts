import { expect, test } from 'bun:test';
import { createSecrets } from '../../src/modules/auth/secrets';

test('encrypted secrets authenticate purpose, context and ciphertext without storing plaintext', async () => {
  const secrets = await createSecrets('aa'.repeat(32), 'bb'.repeat(32), 1);
  const sealed = await secrets.seal('refresh', 'old-digest', { token: 'private-token' });
  expect(sealed).not.toContain('private-token');
  expect(await secrets.open('refresh', 'old-digest', sealed)).toEqual({ token: 'private-token' });
  await expect(secrets.open('account', 'old-digest', sealed)).rejects.toThrow();
  await expect(secrets.open('refresh', 'other-digest', sealed)).rejects.toThrow();
  await expect(
    secrets.open('refresh', 'old-digest', `${sealed.slice(0, -5)}AAAAA`),
  ).rejects.toThrow();
});

test('nonce derivation binds provider, challenge and client proof; domains do not collide', async () => {
  const secrets = await createSecrets('aa'.repeat(32), 'bb'.repeat(32), 1);
  const nonce = await secrets.mac('nonce', ['google', 'challenge', 'proof']);
  expect(nonce).toHaveLength(64);
  expect(await secrets.mac('nonce', ['apple', 'challenge', 'proof'])).not.toBe(nonce);
  expect(await secrets.mac('nonce', ['google', 'other', 'proof'])).not.toBe(nonce);
  expect(await secrets.mac('idempotency', ['google', 'challenge', 'proof'])).not.toBe(nonce);
});

test('missing or shared keys fail closed', async () => {
  await expect(createSecrets('', '', 1)).rejects.toThrow();
  await expect(createSecrets('aa'.repeat(32), 'aa'.repeat(32), 1)).rejects.toThrow();
});

test('MAC verification rejects tampering and wrong scope through WebCrypto verification', async () => {
  const secrets = await createSecrets('aa'.repeat(32), 'bb'.repeat(32), 1);
  const mac = await secrets.mac('list-cursor', ['user:route', 'id']);
  expect(await secrets.verifyMac('list-cursor', ['user:route', 'id'], mac)).toBe(true);
  expect(await secrets.verifyMac('list-cursor', ['other:route', 'id'], mac)).toBe(false);
  expect(await secrets.verifyMac('list-cursor', ['user:route', 'id'], 'invalid')).toBe(false);
});
