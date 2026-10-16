import { expect, test } from 'bun:test';
import { createApiClient } from '../api/client';
import { createRuntimeCredentialStore } from './credential-storage';
import { createApiSession, type Session as ApiSessionCredential } from '../session/api-session';
import { createSessionAuthority } from '../session/authority';
import type { CredentialStore, Session } from '../session/authority';

const userId = '550e8400-e29b-41d4-a716-446655440001';
const requestId = '550e8400-e29b-41d4-a716-446655440099';
const session: Session = {
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  userId,
  expiresAt: '2020-01-01T00:00:00Z',
};
const profile = { id: userId, displayName: 'Ada', houses: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function credentialStore(
  initial: Session | null = session,
): CredentialStore & { value: Session | null } {
  return {
    value: initial,
    async load() {
      return this.value;
    },
    async save(value) {
      this.value = value;
    },
    async clear() {
      this.value = null;
    },
  };
}

function ok(data: unknown) {
  return Response.json({ data, requestId });
}

test('web selects volatile storage while bare/standalone native selects SecureStore', () => {
  const native = credentialStore();
  const web = credentialStore(null);
  expect(createRuntimeCredentialStore('web', native, web)).toBe(web);
  expect(createRuntimeCredentialStore('ios', native, web)).toBe(native);
  expect(createRuntimeCredentialStore('android', native, web)).toBe(native);
});

test('single authority makes logout invalidate a delayed bootstrap refresh and cached transport token', async () => {
  const credentials = credentialStore();
  const refreshResponse = deferred<Response>();
  const authority = createSessionAuthority({ baseUrl: 'https://api.example.test', credentials });
  const session = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    fetcher: async (input) =>
      String(input).endsWith('/refresh') ? refreshResponse.promise : ok(profile),
  });
  const requests: Request[] = [];
  const client = createApiClient({
    baseUrl: 'https://api.example.test',
    session,
    fetcher: async (input, init) => {
      requests.push(new Request(input, init));
      return ok({ saved: true });
    },
  });

  const bootstrapping = session.bootstrap();
  await Promise.resolve();
  await session.logout();
  refreshResponse.resolve(ok({ ...session, accessToken: 'resurrected' }));

  await expect(bootstrapping).rejects.toThrow(/Session changed/);
  await expect(client.request('/v1/me')).rejects.toMatchObject({ name: 'SessionUnavailableError' });
  expect(requests).toHaveLength(0);
  expect(credentials.value).toBeNull();
});

test('accepted session is the token source for subsequent API transport requests', async () => {
  const credentials = credentialStore();
  const authority = createSessionAuthority({ baseUrl: 'https://api.example.test', credentials });
  const session = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    fetcher: async () => ok(profile),
  });
  let transportRequest: Request | undefined;
  const client = createApiClient({
    baseUrl: 'https://api.example.test',
    session,
    fetcher: async (input, init) => {
      transportRequest = new Request(input, init);
      return ok({ saved: true });
    },
  });

  await session.acceptSession({
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
    userId,
    expiresAt: '2099-01-01T00:00:00Z',
  } satisfies ApiSessionCredential);
  await client.request('/v1/houses');

  expect(credentials.value?.accessToken).toBe('new-access');
  expect(transportRequest?.headers.get('authorization')).toBe('Bearer new-access');
});

test('API logout posts revocation and clears credentials if the server fails', async () => {
  const credentials = credentialStore({ ...session, expiresAt: '2099-01-01T00:00:00Z' });
  const authority = createSessionAuthority({ baseUrl: 'https://api.example.test', credentials });
  let logoutRequest: Request | undefined;
  const api = createApiSession({
    baseUrl: 'https://api.example.test',
    credentials,
    authority,
    createIdempotencyKey: () => requestId,
    fetcher: async (input, init) => {
      logoutRequest = new Request(input, init);
      return Response.json(
        { error: { code: 'temporarily_unavailable', message: 'Unavailable' }, requestId },
        { status: 503 },
      );
    },
  });

  await expect(api.logout()).rejects.toMatchObject({ status: 503 });

  expect(logoutRequest?.url).toBe('https://api.example.test/v1/auth/logout');
  expect(logoutRequest?.headers.get('authorization')).toBe('Bearer old-access');
  expect(credentials.value).toBeNull();
  expect(await authority.getAccessToken()).toBeNull();
});
