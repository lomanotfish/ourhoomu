import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from '@neondatabase/serverless';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '../../src/db/schema';
import { syntheticDigest } from './fixtures';
import { loadTarget } from './target';

const { secrets } = loadTarget();
const owner = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 1 });
type SnapshotTable = {
  columns: Record<string, { type: string; notNull: boolean; default?: unknown }>;
  foreignKeys: Record<
    string,
    { name: string; columnsFrom: string[]; tableTo: string; columnsTo: string[] }
  >;
  compositePrimaryKeys: Record<string, { name: string; columns: string[] }>;
  checkConstraints: Record<string, unknown>;
  indexes: Record<string, unknown>;
};
const snapshot = JSON.parse(
  readFileSync(new URL('../../drizzle/meta/0003_snapshot.json', import.meta.url), 'utf8'),
) as { tables: Record<string, SnapshotTable> };
try {
  for (const table of [schema.authRequestLocators, schema.httpSeamMigrationState]) {
    const model = getTableConfig(table);
    const saved = snapshot.tables[`core.${model.name}`];
    assert(saved);
    assert.equal(model.enableRLS, true);
    const columns = (
      await owner.query(
        `select a.attname name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull not_null,a.atthasdef has_default
      from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attname`,
        [`core.${model.name}`],
      )
    ).rows;
    const declared = model.columns
      .map((c) => ({
        name: c.name,
        type: c.getSQLType(),
        not_null: c.notNull,
        has_default: c.hasDefault,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(columns, declared);
    assert.deepEqual(
      columns,
      Object.entries(saved.columns)
        .map(([name, c]) => ({
          name,
          type: c.type,
          not_null: c.notNull,
          has_default: c.default !== undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    const constraints = (
      await owner.query(
        'select conname name,contype type,pg_get_constraintdef(oid) definition from pg_constraint where conrelid=$1::regclass',
        [`core.${model.name}`],
      )
    ).rows;
    assert.deepEqual(
      constraints
        .filter((c) => c.type === 'c')
        .map((c) => c.name)
        .sort(),
      model.checks.map((c) => c.name).sort(),
    );
    assert.deepEqual(
      constraints
        .filter((c) => c.type === 'c')
        .map((c) => c.name)
        .sort(),
      Object.keys(saved.checkConstraints).sort(),
    );
    for (const [name, fk] of Object.entries(saved.foreignKeys)) {
      const actual = constraints.find((c) => c.type === 'f' && c.name === name);
      assert(actual);
      assert.equal(
        actual.definition,
        `FOREIGN KEY (${fk.columnsFrom.join(', ')}) REFERENCES core.${fk.tableTo}(${fk.columnsTo.join(', ')})`,
      );
      assert(model.foreignKeys.some((c) => c.getName() === name));
    }
    for (const pk of Object.values(saved.compositePrimaryKeys)) {
      assert.equal(
        constraints.find((c) => c.type === 'p' && c.name === pk.name)?.definition,
        `PRIMARY KEY (${pk.columns.join(', ')})`,
      );
    }
    const indexes = (
      await owner.query('select indexname from pg_indexes where schemaname=$1 and tablename=$2', [
        'core',
        model.name,
      ])
    ).rows.map((r) => r.indexname);
    for (const name of Object.keys(saved.indexes)) assert(indexes.includes(name));
    const protection = (
      await owner.query(
        'select relrowsecurity enabled,relforcerowsecurity forced from pg_class where oid=$1::regclass',
        [`core.${model.name}`],
      )
    ).rows[0];
    assert.deepEqual(protection, { enabled: true, forced: true });
    for (const role of ['ourhoomu_core_app', 'ourhoomu_core_auth']) {
      const privileges = (
        await owner.query(
          "select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') allowed",
          [role, `core.${model.name}`],
        )
      ).rows[0];
      assert.equal(privileges.allowed, false);
    }
    console.log(
      `PASS ${model.name}: actual columns/types/nullability/defaults/constraints/indexes match canonical model and snapshot; FORCE RLS and runtime deny`,
    );
  }
  const resultColumn = (
    await owner.query(
      "select format_type(atttypid,atttypmod) type,attnotnull not_null from pg_attribute where attrelid='core.idempotency_records'::regclass and attname='result_data'",
    )
  ).rows[0];
  assert.deepEqual(resultColumn, { type: 'jsonb', not_null: false });
  assert.equal(schema.idempotency.resultData.getSQLType(), 'jsonb');
  assert.equal(snapshot.tables['core.idempotency_records']?.columns.result_data?.type, 'jsonb');
  console.log(
    'PASS command result_data nullable jsonb is modeled, snapshotted and present on actual DB',
  );
  const client = await owner.connect();
  try {
    await client.query('BEGIN');
    for (const ttl of [0, 86401]) {
      await client.query('SAVEPOINT invalid_ttl');
      await assert.rejects(
        () =>
          client.query(
            "insert into core.auth_request_locators(route,key_digest,body_hash,challenge_id,expires_at) values('challenge',$1,$2,gen_random_uuid(),statement_timestamp()+make_interval(secs=>$3))",
            [syntheticDigest(), syntheticDigest(), ttl],
          ),
        (e: unknown) => !!e && typeof e === 'object' && 'code' in e && e.code === '23514',
      );
      await client.query('ROLLBACK TO SAVEPOINT invalid_ttl');
    }
    console.log('PASS actual anonymous locator CHECK rejects zero and beyond24h retention');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
} finally {
  await owner.end();
}
