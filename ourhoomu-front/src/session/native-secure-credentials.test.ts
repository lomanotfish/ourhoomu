import { expect, test } from 'bun:test';
import {
  createNativeSecureCredentialStore,
  type NativeSecureStorage,
} from './native-secure-credentials';
import { CredentialStorageError } from './secure-credentials';
import type { Session } from './authority';

const session: Session = {
  accessToken: 'fixture-access',
  refreshToken: 'fixture-refresh',
  expiresAt: '2026-10-15T13:00:00Z',
  userId: '550e8400-e29b-41d4-a716-446655440001',
};

test('native binding uses the same app service and device-only unlocked options for every operation', async () => {
  const calls: unknown[][] = [];
  let value: string | null = null;
  const native: NativeSecureStorage = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
    async isAvailableAsync() {
      return true;
    },
    async getItemAsync(key, options) {
      calls.push(['get', key, options]);
      return value;
    },
    async setItemAsync(key, next, options) {
      calls.push(['set', key, options]);
      value = next;
    },
    async deleteItemAsync(key, options) {
      calls.push(['delete', key, options]);
      value = null;
    },
  };
  const store = createNativeSecureCredentialStore(async () => native);
  await store.save(session);
  expect(await store.load()).toEqual(session);
  await store.clear();
  expect(calls).toEqual(
    ['set', 'get', 'delete', 'get'].map((method) => [
      method,
      'ourhoomu.session',
      {
        keychainService: 'app.ourhoomu.session',
        keychainAccessible: 6,
        requireAuthentication: false,
      },
    ]),
  );
});

test('missing native module is lazy and returns an opaque unavailable error', async () => {
  const store = createNativeSecureCredentialStore(async () => {
    throw new Error('fixture-secret');
  });
  const error = await store.load().catch((error: unknown) => error);
  expect(error).toBeInstanceOf(CredentialStorageError);
  expect(error).toMatchObject({ code: 'unavailable' });
  expect(String(error)).not.toContain('fixture-');
  expect(error).not.toHaveProperty('cause');
});
