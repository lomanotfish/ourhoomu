import { expect, test } from 'bun:test';
import { sealReplay, openReplay } from '../../src/db/replay';
test('authenticated replay ciphertext binds actor/route/key and never stores the raw token', async () => {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const scope = 'actor:route:key';
  const token = 'synthetic-raw-invite-token';
  const sealed = await sealReplay(key, scope, { token });
  expect(sealed).not.toContain(token);
  expect(await openReplay(key, scope, sealed)).toEqual({ token });
  await expect(openReplay(key, 'different-actor:route:key', sealed)).rejects.toThrow();
  const tampered = `${sealed.slice(0, -2)}${sealed.endsWith('00') ? '01' : '00'}`;
  await expect(openReplay(key, scope, tampered)).rejects.toThrow();
});
