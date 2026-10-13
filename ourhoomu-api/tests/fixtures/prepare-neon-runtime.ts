import { appendFileSync, openSync, readFileSync, writeFileSync, closeSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { assertSyntheticDbUrl } from './synthetic-target';

const secretPath = process.env.SYNTHETIC_DB_ENV_FILE;
const receiptPath = process.env.NEON_BRANCH_RECEIPT;
if (!secretPath || !receiptPath) {
  throw new Error('Set SYNTHETIC_DB_ENV_FILE and NEON_BRANCH_RECEIPT to the private synthetic-branch files');
}

const secrets = Object.fromEntries(
  readFileSync(secretPath, 'utf8').split('\n').filter(Boolean).map((line) => {
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error('Malformed private environment file');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }),
);
const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as {
  branch: { id: string; name: string; init_source: string };
  endpoints: Array<{ id: string; branch_id: string }>;
};
if (
  secrets.ALLOW_SYNTHETIC_DB !== 'true' || secrets.APP_ENV !== 'test' ||
  secrets.NEON_BRANCH_ID !== receipt.branch.id ||
  receipt.branch.name !== 'dev-core-sw0036-20261013' ||
  receipt.branch.init_source !== 'parent-schema' ||
  !receipt.endpoints.some((endpoint) => endpoint.id === secrets.NEON_ENDPOINT_ID && endpoint.branch_id === receipt.branch.id) ||
  !secrets.MIGRATION_DATABASE_URL
) {
  throw new Error('Refusing fixture setup: synthetic branch receipt and credentials differ');
}
assertSyntheticDbUrl(secrets.MIGRATION_DATABASE_URL, secrets.NEON_ENDPOINT_ID, 'neondb_owner');

if (!secrets.RUNTIME_DATABASE_URL) {
  const password = randomBytes(32).toString('hex');
  const sql = readFileSync(new URL('./neon-runtime.sql', import.meta.url), 'utf8')
    .split('\n').filter((line) => !line.startsWith('\\set')).join('\n')
    .replace(":'runtime_password'", `'${password}'`);
  const statements = sql.split(';').map((statement) => statement.trim()).filter(Boolean);
  const pool = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 1 });
  const client = await pool.connect();
  try {
    const existing = await client.query<{ schema_exists: string | null }>(
      "select to_regnamespace('runtime_probe')::text as schema_exists",
    );
    if (existing.rows[0]?.schema_exists) throw new Error('Fixture schema already exists without a recorded restricted URL');
    await client.query('BEGIN');
    for (const statement of statements) await client.query(statement);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  const url = new URL(secrets.MIGRATION_DATABASE_URL);
  url.username = 'ourhoomu_runtime_probe';
  url.password = password;
  secrets.RUNTIME_DATABASE_URL = url.toString();
  appendFileSync(secretPath, `RUNTIME_DATABASE_URL=${secrets.RUNTIME_DATABASE_URL}\n`);
}

assertSyntheticDbUrl(secrets.RUNTIME_DATABASE_URL, secrets.NEON_ENDPOINT_ID, 'ourhoomu_runtime_probe');

const vars = new URL('../../.dev.vars', import.meta.url);
const handle = openSync(vars, 'wx', 0o600);
try {
  writeFileSync(handle, [
    `DATABASE_URL=${secrets.RUNTIME_DATABASE_URL}`,
    'TEST_ACTOR_A=11111111-1111-4111-8111-111111111111',
    'TEST_ACTOR_B=22222222-2222-4222-8222-222222222222',
    '',
  ].join('\n'));
} finally {
  closeSync(handle);
}
console.log('Synthetic Neon fixture and ignored local Wrangler bindings are ready');
