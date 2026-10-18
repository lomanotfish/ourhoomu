import type * as SecureStore from 'expo-secure-store';
import type { CredentialStore } from './authority';
import { createSecureCredentialStore } from './secure-credentials';

export type NativeSecureStorage = Pick<
  typeof SecureStore,
  | 'isAvailableAsync'
  | 'getItemAsync'
  | 'setItemAsync'
  | 'deleteItemAsync'
  | 'WHEN_UNLOCKED_THIS_DEVICE_ONLY'
>;

export function createNativeSecureCredentialStore(
  loadNative: () => Promise<NativeSecureStorage> = () => import('expo-secure-store'),
): CredentialStore {
  const options = (native: NativeSecureStorage): SecureStore.SecureStoreOptions => ({
    keychainService: 'app.ourhoomu.session',
    keychainAccessible: native.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: false,
  });
  return createSecureCredentialStore({
    isAvailableAsync: async () => (await loadNative()).isAvailableAsync(),
    getItemAsync: async (key) => {
      const native = await loadNative();
      return native.getItemAsync(key, options(native));
    },
    setItemAsync: async (key, value) => {
      const native = await loadNative();
      await native.setItemAsync(key, value, options(native));
    },
    deleteItemAsync: async (key) => {
      const native = await loadNative();
      await native.deleteItemAsync(key, options(native));
    },
  });
}
