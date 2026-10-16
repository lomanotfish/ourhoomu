import { openReplay, sealReplay } from '../../db/replay';
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

export function randomSecret() {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}
export async function digest(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

/** Required, independent server keys; ciphertext authenticates both purpose and scope. */
export async function createSecrets(hmacSecret: string, encryptionSecret: string, version: number) {
  if (
    !/^[0-9a-f]{64}$/.test(hmacSecret) ||
    !/^[0-9a-f]{64}$/.test(encryptionSecret) ||
    hmacSecret === encryptionSecret ||
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    throw new Error('Invalid server secret configuration');
  }
  const bytes = (value: string) =>
    Uint8Array.from(value.match(/../g) ?? [], (part) => Number.parseInt(part, 16));
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    bytes(hmacSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    bytes(encryptionSecret),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
  return {
    hmacKey,
    version,
    async mac(purpose: string, values: string[]) {
      return hex(
        await crypto.subtle.sign(
          'HMAC',
          hmacKey,
          encoder.encode(JSON.stringify([purpose, ...values])),
        ),
      );
    },
    async verifyMac(purpose: string, values: string[], signature: string) {
      if (!/^[0-9a-f]{64}$/.test(signature)) return false;
      return crypto.subtle.verify(
        'HMAC',
        hmacKey,
        bytes(signature),
        encoder.encode(JSON.stringify([purpose, ...values])),
      );
    },
    async seal(purpose: string, context: string, value: Record<string, unknown>) {
      return sealReplay(encryptionKey, JSON.stringify([version, purpose, context]), value);
    },
    async open(purpose: string, context: string, ciphertext: string) {
      return openReplay(encryptionKey, JSON.stringify([version, purpose, context]), ciphertext);
    },
  };
}
export type ServerSecrets = Awaited<ReturnType<typeof createSecrets>>;
