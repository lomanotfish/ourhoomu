import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from '@neondatabase/serverless';
import { loadTarget } from './target';

const { secrets } = loadTarget();
const pool = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 1 });
const client = await pool.connect();
const migration = readFileSync(
  new URL('../../drizzle/0002_house_timezone.sql', import.meta.url),
  'utf8',
);
const previous = "UPDATE core.houses SET name=p->>'name',version=version+1 WHERE id=h;";
const replacement =
  "IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p->>'timezone') THEN PERFORM core.fail('validation_error'); END IF;\n UPDATE core.houses SET name=p->>'name',timezone=p->>'timezone',version=version+1 WHERE id=h;";
const state = async () =>
  (
    await client.query(`
  select p.oid,p.proowner,p.proacl,p.proconfig,p.prosecdef,pg_get_functiondef(p.oid) definition,
    (select jsonb_agg(jsonb_build_array(oid,rolname) order by oid) from pg_roles
      where rolname in ('ourhoomu_core_app','ourhoomu_core_auth','ourhoomu_core_writer')) roles,
    to_regnamespace('runtime_probe')::oid probe
  from pg_proc p where p.oid='core.command(text,uuid,uuid,jsonb,text,text)'::regprocedure
`)
  ).rows[0];
try {
  const patched = await state();
  assert(patched.definition.includes(replacement), 'Run additive patch first');
  await client.query('BEGIN');
  await client.query(patched.definition.replace(replacement, previous));
  const before = await state();
  assert(before.definition.includes(previous));
  await client.query('SAVEPOINT before_patch');
  await client.query(migration);
  assert.deepEqual(await state(), patched);
  await client.query(migration);
  assert.deepEqual(await state(), patched);
  await client.query('ROLLBACK TO SAVEPOINT before_patch');
  assert.deepEqual(await state(), before);
  await client.query('ROLLBACK');
  assert.deepEqual(await state(), patched);
  console.log(
    'PASS additive patch changes only expected function branch, retains OID/security/grants/roles/probe, and reapplies safely',
  );

  console.log('PASS transactional DDL rehearsal rolls back without resetting schema or data');

  await client.query('BEGIN');
  await client.query(
    patched.definition.replace(replacement, previous.replace('version+1', 'version+2')),
  );
  await assert.rejects(() => client.query(migration), /Unexpected core.command definition/);
  await client.query('ROLLBACK');
  assert.deepEqual(await state(), patched);
  console.log(
    'PASS unexpected source fails closed and rollback leaves accepted patched function intact',
  );
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}
