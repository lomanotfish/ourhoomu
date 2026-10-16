import type { CredentialStore } from '../session/authority';

export function createRuntimeCredentialStore(
  platform: 'web' | 'ios' | 'android',
  nativeStore: CredentialStore,
  webStore: CredentialStore,
): CredentialStore {
  if (platform === 'web') return webStore;
  return nativeStore;
}
