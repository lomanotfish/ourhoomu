/** File-only setup. No database connection, migration or provider request. */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTarget, TARGET } from '../../scripts/db/target';
import { assertSyntheticDbUrl } from './synthetic-target';

export function writeCoreHttpBindings(
  commonGitDirectory: string,
  secrets: Record<string, string>,
): string {
  for (const [key, role] of [
    ['CORE_APP_DATABASE_URL', 'ourhoomu_core_app'],
    ['CORE_AUTH_DATABASE_URL', 'ourhoomu_core_auth'],
  ] as const) {
    const value = secrets[key];
    if (!value || /[\r\n]/.test(value)) throw new Error('Explicit synthetic role binding required');
    assertSyntheticDbUrl(value, TARGET.endpoint, role);
  }
  const bindings = {
    CORE_APP_DATABASE_URL: secrets.CORE_APP_DATABASE_URL,
    CORE_AUTH_DATABASE_URL: secrets.CORE_AUTH_DATABASE_URL,
    CORE_HMAC_KEY: randomBytes(32).toString('hex'),
    CORE_AES_KEY: randomBytes(32).toString('hex'),
    CORE_KEY_VERSION: '1',
    CORE_ACCESS_TTL_SECONDS: '900',
    CORE_REFRESH_TTL_SECONDS: '2592000',
    CORE_ISSUERS: JSON.stringify({
      google: {
        issuer: 'https://synthetic.invalid',
        audience: 'core-http-acceptance',
        jwksUrl: 'https://synthetic.invalid/jwks',
        algorithms: ['RS256'],
      },
    }),
  };
  const directory = join(commonGitDirectory, 'core-finish');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = join(directory, 'sw-0005-http.env');
  writeFileSync(
    file,
    Object.entries(bindings)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
    {
      mode: 0o600,
      flag: 'wx',
    },
  );
  return file;
}

if (import.meta.main) {
  try {
    // This validates the explicit synthetic env and receipt before writing.
    const { secrets } = loadTarget();
    const commonGitDirectory = resolve(
      execFileSync('git', ['rev-parse', '--git-common-dir'], {
        encoding: 'utf8',
      }).trim(),
    );
    console.log(writeCoreHttpBindings(commonGitDirectory, secrets));
  } catch {
    console.error(
      'Refusing HTTP binding setup: validate explicit target files and unoccupied output path',
    );
    process.exitCode = 1;
  }
}
