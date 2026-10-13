/** Backend-owned key stays outside PostgreSQL. Scope must bind principal, route and key digest. */
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
function bytes(value: string) {
  if (!/^(?:[a-f0-9]{2})+$/.test(value)) throw new Error('Invalid replay envelope');
  return Uint8Array.from(value.match(/../g) ?? [], (v) => Number.parseInt(v, 16));
}
export async function sealReplay(
  key: CryptoKey,
  scope: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const plaintext = encoder.encode(JSON.stringify(payload));
  if (plaintext.length > 4096 || !scope) throw new Error('Invalid replay payload');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(scope) },
    key,
    plaintext,
  );
  return `v1.${hex(iv)}.${hex(new Uint8Array(ciphertext))}`;
}
/** Call only on a fresh authorized DB result inside its five-minute replay window. */
export async function openReplay(
  key: CryptoKey,
  scope: string,
  envelope: string,
): Promise<Record<string, unknown>> {
  const [version, iv, ciphertext, ...extra] = envelope.split('.');
  if (
    version !== 'v1' ||
    !iv ||
    iv.length !== 24 ||
    !ciphertext ||
    ciphertext.length > 8300 ||
    extra.length ||
    !scope
  )
    throw new Error('Invalid replay envelope');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(iv), additionalData: encoder.encode(scope) },
    key,
    bytes(ciphertext),
  );
  const value: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid replay payload');
  return value as Record<string, unknown>;
}
