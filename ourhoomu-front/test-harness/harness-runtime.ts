// Test-only browser harness runtime. Credentials live in a memory-only store;
// nothing is persisted and no real user credential is ever involved.
//
// Two clearly labelled modes, selected by EXPO_PUBLIC_API_HARNESS_SEED:
// - 'fixture' (default): the store is pre-seeded with a synthetic fixture
//   session for the offline page.route fixture lane.
// - 'none': the store starts empty for the actual-local-HTTP lane; the
//   test-only /signin harness route performs the real synthetic-issuer
//   challenge/exchange flow against the local API and saves the resulting
//   session into this memory store.
import { createApiClient } from '@/api/client';
import { createApiSession } from '@/session/api-session';
import { createSessionAuthority } from '@/session/authority';
import type { CredentialStore, Session } from '@/session/authority';
import { createHouseRepository } from '@/repositories/houses';

const FIXTURE_SESSION: Session = {
  accessToken: 'harness-fixture-access-token',
  refreshToken: 'harness-fixture-refresh-token',
  expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  userId: '550e8400-e29b-41d4-a716-446655440001',
};

function createMemoryCredentialStore(initial: Session | null): CredentialStore {
  let record: Session | null = initial;
  return {
    async load() {
      return record;
    },
    async save(session: Session) {
      record = session;
    },
    async clear() {
      record = null;
    },
  };
}

/**
 * Builds the real production client/session/house repository composition with
 * a memory credential store. In fixture mode the store is pre-seeded with the
 * synthetic fixture session and the HTTP origin is the dedicated synthetic
 * fixture origin where every response is a clearly labelled Playwright route
 * fixture. In unseeded mode the store starts empty for the actual-local-HTTP
 * lane.
 */
export function createHarnessRuntime() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error('Harness requires EXPO_PUBLIC_API_BASE_URL.');
  const seeded = process.env.EXPO_PUBLIC_API_HARNESS_SEED !== 'none';
  const credentials = createMemoryCredentialStore(seeded ? FIXTURE_SESSION : null);
  const authority = createSessionAuthority({
    baseUrl,
    credentials,
    allowDevelopmentLoopback: true,
  });
  const session = createApiSession({
    baseUrl,
    credentials,
    authority,
    allowDevelopmentLoopback: true,
  });
  const client = createApiClient({ baseUrl, session, allowDevelopmentLoopback: true });
  return { client, session, houses: createHouseRepository(client), credentials };
}

// Module-level singleton: AppRuntimeProvider memoizes on the testRuntime
// identity, so a stable object keeps the runtime from being rebuilt on every
// render of the harness layout.
export const harnessRuntime = createHarnessRuntime();
export const harnessCredentials = harnessRuntime.credentials;
