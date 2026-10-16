import type { IssuerAdapterOptions, IssuerProvider } from '../auth/issuer';

export type CoreBindings = Partial<
  Record<
    | 'CORE_APP_DATABASE_URL'
    | 'CORE_AUTH_DATABASE_URL'
    | 'CORE_HMAC_KEY'
    | 'CORE_AES_KEY'
    | 'CORE_KEY_VERSION'
    | 'CORE_ACCESS_TTL_SECONDS'
    | 'CORE_REFRESH_TTL_SECONDS'
    | 'CORE_ISSUERS',
    string
  >
>;

export function readCoreConfig(env: CoreBindings) {
  const fail = (): never => {
    throw new Error('Core API configuration is unavailable');
  };
  const required = (key: keyof CoreBindings) => env[key] || fail();
  const number = (key: keyof CoreBindings, min: number, max: number) => {
    const value = required(key);
    if (!/^[1-9][0-9]*$/.test(value) || Number(value) < min || Number(value) > max) return fail();
    return Number(value);
  };
  const connection = (key: keyof CoreBindings, role: string) => {
    const value = required(key);
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.username !== role ||
      !url.hostname ||
      !url.password
    )
      return fail();
    return value;
  };
  const key = (name: keyof CoreBindings) => {
    const value = required(name);
    if (!/^[0-9a-f]{64}$/.test(value)) return fail();
    return value;
  };
  const safeUrl = (value: unknown) => {
    if (typeof value !== 'string') return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
    } catch {
      return false;
    }
  };
  const raw: unknown = JSON.parse(required('CORE_ISSUERS'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail();
  const providers: IssuerAdapterOptions['providers'] = {};
  for (const [provider, value] of Object.entries(raw)) {
    if (
      !['google', 'apple'].includes(provider) ||
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    )
      return fail();
    const row = value as Record<string, unknown>;
    if (
      !safeUrl(row.issuer) ||
      !safeUrl(row.jwksUrl) ||
      typeof row.audience !== 'string' ||
      !row.audience ||
      !Array.isArray(row.algorithms) ||
      !row.algorithms.length ||
      row.algorithms.some((alg) => !['RS256', 'ES256'].includes(alg)) ||
      (row.trustedPresenters !== undefined &&
        (!Array.isArray(row.trustedPresenters) ||
          row.trustedPresenters.some((value) => typeof value !== 'string' || !value)))
    )
      return fail();
    providers[provider as IssuerProvider] = {
      issuer: String(row.issuer),
      audience: row.audience,
      jwksUrl: String(row.jwksUrl),
      algorithms: row.algorithms,
      ...(row.trustedPresenters ? { trustedPresenters: row.trustedPresenters as string[] } : {}),
    };
  }
  if (!Object.keys(providers).length) return fail();
  const hmacKey = key('CORE_HMAC_KEY');
  const aesKey = key('CORE_AES_KEY');
  if (hmacKey === aesKey) return fail();
  const accessTtlSeconds = number('CORE_ACCESS_TTL_SECONDS', 1, 3600);
  return {
    appDatabaseUrl: connection('CORE_APP_DATABASE_URL', 'ourhoomu_core_app'),
    authDatabaseUrl: connection('CORE_AUTH_DATABASE_URL', 'ourhoomu_core_auth'),
    hmacKey,
    aesKey,
    keyVersion: number('CORE_KEY_VERSION', 1, 1),
    accessTtlSeconds,
    refreshTtlSeconds: number('CORE_REFRESH_TTL_SECONDS', accessTtlSeconds, 31536000),
    providers,
  };
}
