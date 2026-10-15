import { describe, expect, test } from 'bun:test';
import { createSessionAuthority, type Session } from './authority';
import {
  createSecureCredentialStore,
  CredentialStorageError,
  type SecureStoragePort,
} from './secure-credentials';

const session: Session = {
  accessToken: 'fixture-access',
  refreshToken: 'fixture-refresh',
  expiresAt: '2026-10-15T13:00:00Z',
  userId: '550e8400-e29b-41d4-a716-446655440001',
};
const key = 'ourhoomu.session';

function storage() {
  const records = new Map<string, string>();
  const writes: [string, string][] = [];
  const deleted: string[] = [];
  const port: SecureStoragePort = {
    async isAvailableAsync() {
      return true;
    },
    async getItemAsync(key) {
      return records.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      writes.push([key, value]);
      records.set(key, value);
    },
    async deleteItemAsync(key) {
      deleted.push(key);
      records.delete(key);
    },
  };
  return { records, writes, deleted, port, store: createSecureCredentialStore(port) };
}

async function opaque(operation: Promise<unknown>, code: string) {
  const error = await operation.then(
    () => null,
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(CredentialStorageError);
  expect(error).toMatchObject({ name: 'CredentialStorageError', code });
  expect(String(error)).toBe('CredentialStorageError: Secure credential storage failed');
  expect(error).not.toHaveProperty('cause');
  expect(JSON.stringify(error)).not.toContain('fixture-');
  expect((error as Error).stack).not.toContain('fixture-');
}

describe('secure credential bundle (injected fake storage, no native keychain)', () => {
  test('roundtrips one versioned record and replaces the refresh pair in one write', async () => {
    const { store, writes, records } = storage();
    await store.save(session);
    expect(writes).toEqual([[key, JSON.stringify({ version: 1, session })]]);
    expect(await store.load()).toEqual(session);
    const rotated = {
      ...session,
      accessToken: 'fixture-next-access',
      refreshToken: 'fixture-next-refresh',
    };
    await store.save(rotated);
    expect(writes).toHaveLength(2);
    expect(records.size).toBe(1);
    expect(await store.load()).toEqual(rotated);
  });

  test('absent reads and repeated clear preserve unrelated entries', async () => {
    const { store, records, deleted } = storage();
    records.set('unrelated', 'owned elsewhere');
    expect(await store.load()).toBeNull();
    await store.save(session);
    await store.clear();
    await store.clear();
    expect(await store.load()).toBeNull();
    expect(deleted).toEqual([key, key]);
    expect(records.get('unrelated')).toBe('owned elsewhere');
  });

  const invalid: unknown[] = [
    null,
    [],
    {},
    { version: 2, session },
    { version: '1', session },
    { version: 1, session, extra: true },
    ...[
      { accessToken: '' },
      { accessToken: '   ' },
      { accessToken: 1 },
      { accessToken: 'fixture-access\u0000' },
      { refreshToken: 'fixture-refreshé' },
      { accessToken: 'fixture-access\n' },
      { refreshToken: '' },
      { refreshToken: null },
      { userId: 'not-a-uuid' },
      { expiresAt: 'not-a-date' },
      { expiresAt: 123 },
      { expiresAt: 'Infinity' },
      { expiresAt: '2026-10-15' },
      { extra: 'fixture-secret' },
    ].map((change) => ({ version: 1, session: { ...session, ...change } })),
    { version: 1, session: [session] },
    { version: 1, session: null },
  ];
  for (const [index, value] of invalid.entries()) {
    test(`rejects invalid stored bundle ${index} and deletes only its key`, async () => {
      const { store, records, deleted } = storage();
      records.set(key, JSON.stringify(value));
      records.set('unrelated', 'owned elsewhere');
      expect(await store.load()).toBeNull();
      expect(deleted).toEqual([key]);
      expect(records.has(key)).toBe(false);
      expect(records.get('unrelated')).toBe('owned elsewhere');
    });
  }

  test('malformed JSON is cleared without returning its secrets', async () => {
    const { store, records, deleted } = storage();
    records.set(key, '{fixture-secret');
    expect(await store.load()).toBeNull();
    expect(deleted).toEqual([key]);
  });

  test('invalid saves never overwrite existing credentials', async () => {
    const { store, records, writes } = storage();
    await store.save(session);
    await opaque(store.save({ ...session, refreshToken: '' }), 'invalid-session');
    expect(writes).toHaveLength(1);
    expect(JSON.parse(records.get(key)!).session).toEqual(session);
  });

  for (const operation of ['load', 'save', 'clear'] as const) {
    test(`${operation} fails closed when native storage is unavailable`, async () => {
      const { store, port, records, writes, deleted } = storage();
      records.set(key, JSON.stringify({ version: 1, session }));
      port.isAvailableAsync = async () => false;
      await opaque(operation === 'save' ? store.save(session) : store[operation](), 'unavailable');
      expect(writes).toHaveLength(0);
      expect(deleted).toHaveLength(0);
    });
    test(`${operation} hides availability exceptions`, async () => {
      const { store, port } = storage();
      port.isAvailableAsync = async () => {
        throw new Error('fixture-native-secret');
      };
      await opaque(operation === 'save' ? store.save(session) : store[operation](), 'unavailable');
    });
  }

  for (const [method, code] of [
    ['getItemAsync', 'read'],
    ['setItemAsync', 'write'],
    ['deleteItemAsync', 'delete'],
  ] as const) {
    test(`${method} hides native exceptions and never reports success`, async () => {
      const { store, port } = storage();
      port[method] = async () => {
        throw new Error('fixture-native-secret');
      };
      await opaque(
        code === 'read' ? store.load() : code === 'write' ? store.save(session) : store.clear(),
        code,
      );
    });
  }

  test('failed corrupt-record cleanup propagates a delete error', async () => {
    const { store, port, records } = storage();
    records.set(key, '{fixture-secret');
    port.deleteItemAsync = async () => {
      throw new Error('fixture-native-secret');
    };
    await opaque(store.load(), 'delete');
  });

  test('authority logout waits for an in-flight secure save and leaves storage empty', async () => {
    const { store, port, records } = storage();
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let started!: () => void;
    const saving = new Promise<void>((resolve) => {
      started = resolve;
    });
    port.setItemAsync = async (key, value) => {
      started();
      await gate;
      records.set(key, value);
    };
    const authority = createSessionAuthority({
      baseUrl: 'https://api.example.test',
      credentials: store,
    });
    const replace = authority.replaceSession(session);
    await saving;
    const logout = authority.logout();
    finish();
    await Promise.all([replace, logout]);
    expect(await store.load()).toBeNull();
  });
});
