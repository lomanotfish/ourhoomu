import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from '@neondatabase/serverless';
import { loadTarget } from './target';

const { secrets } = loadTarget();
const pool = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 1 });
const client = await pool.connect();
const sql = readFileSync(new URL('../../drizzle/0003_http_seam.sql', import.meta.url), 'utf8');
const state = async () =>
  (
    await client.query(`select
  (select jsonb_agg(jsonb_build_array(oid,rolname) order by oid) from pg_roles
   where rolname in ('ourhoomu_core_app','ourhoomu_core_auth','ourhoomu_core_writer')) roles,
  to_regnamespace('runtime_probe')::oid probe,
  has_schema_privilege('ourhoomu_core_writer','core','CREATE') writer_create,
  (select jsonb_object_agg(proname,jsonb_build_array(oid,proowner,proacl,proconfig,md5(pg_get_functiondef(oid))))
   from pg_proc where pronamespace='core'::regnamespace and proname in ('command','auth_command','clear_replay_secrets')) functions,
  to_regclass('core.auth_request_locators')::text locators`)
  ).rows[0];
try {
  const before = await state();
  assert.equal(before.locators, null, 'run before applying HTTP seam');
  await client.query('BEGIN');
  await client.query(sql);
  const patched = await state();
  assert.deepEqual(patched.roles, before.roles);
  assert.equal(patched.probe, before.probe);
  assert.equal(patched.writer_create, before.writer_create);
  assert.equal(patched.locators, 'core.auth_request_locators');
  await client.query('ROLLBACK');
  assert.deepEqual(await state(), before);
  console.log(
    'PASS additive DDL transaction rolls back completely; role OIDs/probe/schema privilege preserved',
  );
  await client.query('BEGIN');
  const definition = (
    await client.query(
      "select pg_get_functiondef('core.command(text,uuid,uuid,jsonb,text,text)'::regprocedure) definition",
    )
  ).rows[0].definition;
  await client.query(
    definition.replace(
      "e:=n+interval '168 hours';d:=e+interval '24 hours';",
      "e:=n+interval '167 hours';d:=e+interval '24 hours';",
    ),
  );
  await assert.rejects(() => client.query(sql), /Unknown core.command predecessor/);
  await client.query('ROLLBACK');
  assert.deepEqual(await state(), before);
  console.log('PASS unknown predecessor refuses atomically');
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}
