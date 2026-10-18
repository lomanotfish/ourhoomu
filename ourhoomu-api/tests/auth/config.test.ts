import { expect, test } from 'bun:test';
import { readCoreConfig } from '../../src/modules/core/config';

const valid = {
  CORE_APP_DATABASE_URL: 'postgresql://ourhoomu_core_app:fixture@synthetic.invalid/core',
  CORE_AUTH_DATABASE_URL: 'postgresql://ourhoomu_core_auth:fixture@synthetic.invalid/core',
  CORE_HMAC_KEY: 'aa'.repeat(32),
  CORE_AES_KEY: 'bb'.repeat(32),
  CORE_KEY_VERSION: '1',
  CORE_ACCESS_TTL_SECONDS: '900',
  CORE_REFRESH_TTL_SECONDS: '2592000',
  CORE_ISSUERS: JSON.stringify({
    google: {
      issuer: 'https://synthetic.invalid',
      audience: 'ios',
      jwksUrl: 'https://keys.invalid/jwks',
      algorithms: ['RS256'],
    },
  }),
};
test('core configuration requires exact restricted roles, independent keys and bounded explicit lifetimes', () => {
  expect(readCoreConfig(valid)).toMatchObject({
    accessTtlSeconds: 900,
    refreshTtlSeconds: 2592000,
    keyVersion: 1,
  });
  for (const patch of [
    { CORE_AES_KEY: '' },
    { CORE_AES_KEY: valid.CORE_HMAC_KEY },
    { CORE_HMAC_KEY: 'gg'.repeat(32) },
    { CORE_KEY_VERSION: '2' },
    { CORE_ACCESS_TTL_SECONDS: '0' },
    { CORE_ACCESS_TTL_SECONDS: '3601' },
    { CORE_ACCESS_TTL_SECONDS: '900junk' },
    { CORE_REFRESH_TTL_SECONDS: '899' },
    { CORE_REFRESH_TTL_SECONDS: '31536001' },
    { CORE_APP_DATABASE_URL: 'postgresql://owner:fixture@synthetic.invalid/core' },
    { CORE_AUTH_DATABASE_URL: valid.CORE_APP_DATABASE_URL },
    { CORE_ISSUERS: '{' },
    { CORE_ISSUERS: '{}' },
    {
      CORE_ISSUERS: JSON.stringify({
        google: {
          issuer: 'https://synthetic.invalid',
          audience: 'ios',
          jwksUrl: 'http://keys.invalid/jwks',
          algorithms: ['RS256'],
        },
      }),
    },
  ])
    expect(() => readCoreConfig({ ...valid, ...patch })).toThrow();
  expect(() => readCoreConfig({})).toThrow();
});
