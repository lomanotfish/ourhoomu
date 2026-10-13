import { readFileSync } from 'node:fs';
import { Pool } from '@neondatabase/serverless';
import { assertSyntheticDbUrl } from './synthetic-target';

type ProbeData = {
  role: string;
  actor: string;
  rows: Array<{ actor_id: string }>;
  outsideActor: string | null;
};

const actorA = '11111111-1111-4111-8111-111111111111';
const actorB = '22222222-2222-4222-8222-222222222222';
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
  !receipt.endpoints.some((endpoint) => endpoint.id === secrets.NEON_ENDPOINT_ID && endpoint.branch_id === receipt.branch.id)
) {
  throw new Error('Synthetic branch metadata does not match the provisioning receipt');
}

assertSyntheticDbUrl(secrets.MIGRATION_DATABASE_URL, secrets.NEON_ENDPOINT_ID, 'neondb_owner');
assertSyntheticDbUrl(secrets.RUNTIME_DATABASE_URL, secrets.NEON_ENDPOINT_ID, 'ourhoomu_runtime_probe');

const base = process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:8787';
async function requestActor(actor: 'a' | 'b', fail = false): Promise<{ status: number; body: { data?: ProbeData; error?: { code: string } } }> {
  const path = `/runtime/db/${actor}${fail ? '?fail=after-write' : ''}`;
  const response = await fetch(new URL(path, base), {
    method: 'POST',
    headers: { authorization: 'Bearer runtime-fixture-only' },
  });
  return { status: response.status, body: await response.json() as { data?: ProbeData; error?: { code: string } } };
}

for (const [actor, expected] of [['a', actorA], ['b', actorB], ['a', actorA]] as const) {
  const { status, body } = await requestActor(actor);
  const data = body.data;
  if (
    status !== 200 || data?.role !== 'ourhoomu_runtime_probe' || data.actor !== expected ||
    data.rows.length !== 1 || data.rows[0]?.actor_id !== expected ||
    ![null, ''].includes(data.outsideActor)
  ) {
    throw new Error(`Actor ${actor} failed RLS or context isolation`);
  }
}

const failed = await requestActor('a', true);
if (failed.status !== 500 || failed.body.error?.code !== 'probe_failed') {
  throw new Error('Forced rollback did not surface the expected test-only response');
}
const afterFailure = await requestActor('b');
if (afterFailure.status !== 200 || afterFailure.body.data?.rows[0]?.actor_id !== actorB) {
  throw new Error('A subsequent actor request was contaminated by the failed transaction');
}

const owner = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 1 });
const runtime = new Pool({ connectionString: secrets.RUNTIME_DATABASE_URL, max: 1 });
try {
  const rolledBack = await owner.query<{ count: number }>('select count(*)::int as count from runtime_probe.rollback_probe');
  const withoutActor = await runtime.query<{ count: number }>('select count(*)::int as count from runtime_probe.visible_rows');
  const role = await runtime.query<{ rolbypassrls: boolean; rolsuper: boolean; rolcreaterole: boolean }>(
    'select rolbypassrls, rolsuper, rolcreaterole from pg_roles where rolname=current_user',
  );
  if (
    rolledBack.rows[0]?.count !== 0 || withoutActor.rows[0]?.count !== 0 ||
    !role.rows[0] || role.rows[0].rolbypassrls || role.rows[0].rolsuper || role.rows[0].rolcreaterole
  ) {
    throw new Error('Rollback, empty actor or restricted-role proof failed');
  }
} finally {
  await owner.end();
  await runtime.end();
}

console.log('Neon/workerd proof passed: two actors, restricted RLS, rollback, empty context and next-request isolation');
