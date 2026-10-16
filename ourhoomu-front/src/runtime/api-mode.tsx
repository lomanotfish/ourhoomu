import React, { createContext, useContext, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { createApiClient } from '../api/client';
import type { ApiClient } from '../api/client';
import { createSessionAuthority } from '../session/authority';
import { createNativeSecureCredentialStore } from '../session/native-secure-credentials';
import { createSecureCredentialStore } from '../session/secure-credentials';
import type { CredentialStore } from '../session/authority';
import { createRuntimeCredentialStore } from './credential-storage';
import { createApiSession } from '../session/api-session';
import { createHouseRepository } from '../repositories/houses';
import type { ApiSession } from '../session/api-session';

export type FrontendMode = 'demo' | 'api';
export type ApiRuntime = {
  client: ApiClient;
  session: ApiSession;
  houses: ReturnType<typeof createHouseRepository>;
};

type RuntimeContextValue = { mode: FrontendMode; runtime: ApiRuntime | null };
type RuntimeOverrides = Partial<Pick<ApiRuntime, 'client' | 'session' | 'houses'>>;
const RuntimeContext = createContext<RuntimeContextValue>({ mode: 'demo', runtime: null });

export function AppRuntimeProvider({
  children,
  testRuntime,
}: {
  children: React.ReactNode;
  testRuntime?: RuntimeOverrides;
}) {
  const mode: FrontendMode = process.env.EXPO_PUBLIC_APP_MODE === 'api' ? 'api' : 'demo';
  const [cacheRevision, setCacheRevision] = useState(0);
  const runtime = useMemo(() => {
    if (mode !== 'api') return null;
    if (testRuntime) {
      if (!__DEV__ || process.env.EXPO_PUBLIC_API_TEST_HARNESS !== 'true') {
        throw new Error('The injected API test runtime requires the explicit development harness.');
      }
      const client = testRuntime.client;
      const session = testRuntime.session;
      const houses = testRuntime.houses;
      if (!client || !session || !houses) {
        throw new Error('The injected API test runtime is incomplete.');
      }
      return { client, session, houses };
    }
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!baseUrl) throw new Error('API mode requires EXPO_PUBLIC_API_BASE_URL.');
    const loopbackAllowed = process.env.EXPO_PUBLIC_API_LOCAL_ACCEPTANCE === 'true' && __DEV__;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android' && Platform.OS !== 'web') {
      throw new Error('Secure native credential storage is unavailable in this runtime.');
    }
    // Platform is authoritative: bare/standalone RN never falls back to volatile storage.
    const credentialStore = createRuntimeCredentialStore(
      Platform.OS,
      createNativeSecureCredentialStore(),
      createSecureCredentialStore(createMemoryStorage()),
    );
    const clearCache = () => setCacheRevision((current) => current + 1);
    const authority = createSessionAuthority({
      baseUrl,
      credentials: credentialStore,
      allowDevelopmentLoopback: loopbackAllowed,
      onAuthenticatedCacheClear: clearCache,
    });
    const apiSession = createApiSession({
      baseUrl,
      credentials: credentialStore,
      authority,
      allowDevelopmentLoopback: loopbackAllowed,
      onAuthenticatedCacheClear: clearCache,
    });
    const client = createApiClient({
      baseUrl,
      session: apiSession,
      allowDevelopmentLoopback: loopbackAllowed,
    });
    return { client, session: apiSession, houses: createHouseRepository(client) };
  }, [mode, testRuntime]);
  // cacheRevision intentionally causes consumers of the context to observe cache invalidation.
  void cacheRevision;
  return <RuntimeContext.Provider value={{ mode, runtime }}>{children}</RuntimeContext.Provider>;
}

export function useAppRuntime(): RuntimeContextValue {
  return useContext(RuntimeContext);
}

function createMemoryStorage() {
  let record: string | null = null;
  return {
    async isAvailableAsync() {
      return true;
    },
    async getItemAsync(key: string) {
      return key === 'ourhoomu.session' ? record : null;
    },
    async setItemAsync(key: string, value: string) {
      if (key === 'ourhoomu.session') record = value;
    },
    async deleteItemAsync(key: string) {
      if (key === 'ourhoomu.session') record = null;
    },
  };
}
