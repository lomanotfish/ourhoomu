import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeCoreHttpBindings } from '../fixtures/prepare-core-http';
import { readCoreConfig } from '../../src/modules/core/config';

const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});
function directory() {
  const path = mkdtempSync(join(tmpdir(), 'core-http-setup-'));
  directories.push(path);
  return path;
}
const host = 'ep-dry-breeze-b3e8t69s.ap-southeast-1.aws.neon.tech';
const target = {
  CORE_APP_DATABASE_URL: `postgresql://ourhoomu_core_app:fixture@${host}/neondb?sslmode=require`,
  CORE_AUTH_DATABASE_URL: `postgresql://ourhoomu_core_auth:fixture@${host}/neondb?sslmode=require`,
  DATABASE_URL: 'must-not-copy-production',
};

test('HTTP binding preparation writes only explicit synthetic configuration with fresh private keys', () => {
  const path = writeCoreHttpBindings(directory(), target);
  expect(statSync(path).mode & 0o777).toBe(0o600);
  const env = Object.fromEntries(
    readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  const config = readCoreConfig(env);
  expect(Object.keys(env).sort()).toEqual([
    'CORE_ACCESS_TTL_SECONDS',
    'CORE_AES_KEY',
    'CORE_APP_DATABASE_URL',
    'CORE_AUTH_DATABASE_URL',
    'CORE_HMAC_KEY',
    'CORE_ISSUERS',
    'CORE_KEY_VERSION',
    'CORE_REFRESH_TTL_SECONDS',
  ]);
  expect(config.providers.google).toEqual({
    issuer: 'https://synthetic.invalid',
    audience: 'core-http-acceptance',
    jwksUrl: 'https://synthetic.invalid/jwks',
    algorithms: ['RS256'],
  });
  expect(config.hmacKey).not.toBe(config.aesKey);
  expect(config.accessTtlSeconds).toBe(900);
  expect(config.refreshTtlSeconds).toBe(2592000);
  const second = writeCoreHttpBindings(directory(), target);
  expect(readFileSync(second, 'utf8') === readFileSync(path, 'utf8')).toBe(false);
  expect(() => writeCoreHttpBindings(join(path, '..', '..'), target)).toThrow();
});

test('HTTP binding preparation rejects missing roles, other targets and env injection before writing', () => {
  for (const changed of [
    { CORE_AUTH_DATABASE_URL: '' },
    {
      CORE_APP_DATABASE_URL: target.CORE_APP_DATABASE_URL.replace(
        host,
        'linked-production.invalid',
      ),
    },
    { CORE_AUTH_DATABASE_URL: target.CORE_APP_DATABASE_URL },
    { CORE_APP_DATABASE_URL: `${target.CORE_APP_DATABASE_URL}\nATTACK=true` },
  ])
    expect(() => writeCoreHttpBindings(directory(), { ...target, ...changed })).toThrow();
});
