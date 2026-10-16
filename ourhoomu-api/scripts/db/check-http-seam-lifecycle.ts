import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { Pool } from '@neondatabase/serverless';
import { loadTarget } from './target';
const { secrets } = loadTarget();
const owner = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 1 });
const run = (mode: string) =>
  spawnSync(process.execPath, ['scripts/db/migrate.ts', mode], {
    encoding: 'utf8',
    env: process.env,
  });
try {
  const original = (
    await owner.query(
      'select command_definition,clear_definition from core.http_seam_migration_state',
    )
  ).rows[0];
  const authDefinition = (
    await owner.query(
      "select pg_get_functiondef('core.auth_command_before_http(text,jsonb)'::regprocedure) definition",
    )
  ).rows[0].definition.replace(
    'FUNCTION core.auth_command_before_http(',
    'FUNCTION core.auth_command(',
  );
  const identities = async () =>
    (
      await owner.query(
        "select (select jsonb_agg(jsonb_build_array(oid,rolname) order by oid) from pg_roles where rolname in ('ourhoomu_core_app','ourhoomu_core_auth','ourhoomu_core_writer')) roles,to_regnamespace('runtime_probe')::oid probe,has_schema_privilege('ourhoomu_core_writer','core','CREATE') writer_create",
      )
    ).rows[0];
  const before = await identities();
  const reapplied = run('patch-http-seam');
  assert.equal(reapplied.status, 0, reapplied.stderr);
  console.log('PASS exact reapply no-op');
  const projectionDefinition = (
    await owner.query(
      "select pg_get_functiondef('core.http_projection(text,uuid,uuid)'::regprocedure) definition",
    )
  ).rows[0].definition;
  const drift = projectionDefinition.replace(
    'RETURN result;',
    'RETURN result; -- synthetic fingerprint drift',
  );
  assert.notEqual(drift, projectionDefinition);
  try {
    await owner.query(drift);
    for (const mode of ['patch-http-seam', 'rollback-http-seam']) {
      const unknown = run(mode);
      assert.equal(unknown.status, 1);
      assert.match(
        unknown.stderr,
        /Refusing unknown HTTP seam migration or changed function definitions/,
      );
    }
  } finally {
    await owner.query(projectionDefinition);
  }
  assert.deepEqual(await identities(), before);
  console.log('PASS changed routine fingerprint refuses both reapply and rollback');
  const refused = run('rollback-http-seam');
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Refusing rollback with retained HTTP replay data/);
  assert.deepEqual(await identities(), before);
  console.log('PASS occupied rollback refuses without changing role/probe state');
  // All HTTP locators are created by this exclusive synthetic test window, not product traffic.
  // Age those disposable fixtures through their actual janitor; never bypass rollback refusal.
  await owner.query(
    "update core.auth_request_locators set created_at=statement_timestamp()-interval '25 hours',expires_at=statement_timestamp()-interval '1 hour',replay_until=case when route='exchange' then statement_timestamp()-interval '25 hours'+interval '1 minute' end",
  );
  await owner.query(
    "update core.idempotency_records set replay_until=statement_timestamp()-interval '1 second',created_at=least(created_at,statement_timestamp()-interval '2 seconds') where result_data is not null",
  );
  await owner.query('select core.clear_replay_secrets()');
  const rolledBack = run('rollback-http-seam');
  assert.equal(rolledBack.status, 0, rolledBack.stderr);
  assert.deepEqual(await identities(), before);
  const restored = (
    await owner.query(
      "select pg_get_functiondef('core.command(text,uuid,uuid,jsonb,text,text)'::regprocedure) command_definition,pg_get_functiondef('core.clear_replay_secrets()'::regprocedure) clear_definition,pg_get_functiondef('core.auth_command(text,jsonb)'::regprocedure) auth_definition,to_regclass('core.auth_request_locators')::text locators",
    )
  ).rows[0];
  assert.equal(restored.command_definition, original.command_definition);
  assert.equal(restored.clear_definition, original.clear_definition);
  assert.equal(restored.auth_definition, authDefinition);
  assert.equal(restored.locators, null);
  console.log(
    'PASS unoccupied rollback restores exact accepted definitions; OIDs/probe and writer privilege preserved',
  );
} finally {
  await owner.end();
}
