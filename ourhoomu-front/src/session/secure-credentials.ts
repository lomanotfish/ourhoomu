import type { CredentialStore, Session } from './authority';
import { isRecord, isUuid } from '../api/errors';

// Keep the native import in native-secure-credentials.ts, outside the testable boundary.
export interface SecureStoragePort {
  isAvailableAsync(): Promise<boolean>;
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

type StorageErrorCode = 'unavailable' | 'read' | 'write' | 'delete' | 'invalid-session';

export class CredentialStorageError extends Error {
  constructor(readonly code: StorageErrorCode) {
    super('Secure credential storage failed');
    this.name = 'CredentialStorageError';
  }
}

const credentialKey = 'ourhoomu.session';

export function createSecureCredentialStore(storage: SecureStoragePort): CredentialStore {
  async function available(): Promise<void> {
    let enabled = false;
    try {
      enabled = await storage.isAvailableAsync();
    } catch {
      throw new CredentialStorageError('unavailable');
    }
    if (!enabled) throw new CredentialStorageError('unavailable');
  }

  async function remove(): Promise<void> {
    try {
      await storage.deleteItemAsync(credentialKey);
      // Native deletion can resolve without removing the record (e.g. iOS statuses).
      if ((await storage.getItemAsync(credentialKey)) !== null) {
        throw new CredentialStorageError('delete');
      }
    } catch {
      throw new CredentialStorageError('delete');
    }
  }

  return {
    async load() {
      await available();
      let raw: string | null;
      try {
        raw = await storage.getItemAsync(credentialKey);
      } catch {
        throw new CredentialStorageError('read');
      }
      if (raw === null) return null;
      let bundle: unknown;
      try {
        bundle = JSON.parse(raw);
      } catch {
        // Invalid records are removed below; JSON parser messages may contain secrets.
      }
      if (
        isRecord(bundle) &&
        Object.keys(bundle).every((key) => ['version', 'session'].includes(key)) &&
        bundle.version === 1 &&
        isSession(bundle.session)
      ) {
        return bundle.session;
      }
      await remove();
      return null;
    },
    async save(session) {
      let value: string;
      try {
        if (!isSession(session)) throw new CredentialStorageError('invalid-session');
        value = JSON.stringify({ version: 1, session });
      } catch {
        throw new CredentialStorageError('invalid-session');
      }
      await available();
      try {
        await storage.setItemAsync(credentialKey, value);
      } catch {
        throw new CredentialStorageError('write');
      }
    },
    async clear() {
      await available();
      await remove();
    },
  };
}

function isSession(value: unknown): value is Session {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) =>
      ['accessToken', 'refreshToken', 'expiresAt', 'userId'].includes(key),
    ) &&
    typeof value.accessToken === 'string' &&
    /^[\x21-\x7e]+$/.test(value.accessToken) &&
    typeof value.refreshToken === 'string' &&
    /^[\x21-\x7e]+$/.test(value.refreshToken) &&
    isUuid(value.userId) &&
    typeof value.expiresAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.expiresAt) &&
    Number.isFinite(Date.parse(value.expiresAt))
  );
}
