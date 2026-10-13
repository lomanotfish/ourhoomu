import { appendFileSync, readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { loadTarget } from './target';

const { secrets, secretPath } = loadTarget();
const pool = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  const before = await client.query<{ probe: string | null; core: string | null }>(
    "select to_regnamespace('runtime_probe')::text probe,to_regnamespace('core')::text core",
  );
  const probe = before.rows[0]?.probe;
  const mode = process.argv[2] ?? 'up';
  if (mode === 'rollback') {
    // Rollback is ONLY allowed on this exact disposable synthetic branch, and only our objects.
    await client.query('BEGIN');
    await client.query('DROP SCHEMA IF EXISTS core CASCADE');
    // Keep hardened role OIDs and credentials stable across synthetic schema rehearsals.
    // PgBouncer may retain authenticated backends; dropping/recreating roles makes those OIDs stale.
    await client.query('COMMIT');
    console.log('Synthetic core-only rollback complete; runtime_probe preserved');
  } else if (mode === 'up') {
    if (before.rows[0]?.core)
      throw new Error('Core schema exists; refusing unreviewed overwrite/reset');
    const roles = await client.query<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolcanlogin: boolean;
    }>(
      "select rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolcanlogin from pg_roles where rolname in ('ourhoomu_core_app','ourhoomu_core_auth','ourhoomu_core_writer')",
    );
    const reuse = roles.rows.length === 3;
    if (
      roles.rows.length !== 0 &&
      (!reuse ||
        !secrets.CORE_APP_DATABASE_URL ||
        !secrets.CORE_AUTH_DATABASE_URL ||
        roles.rows.some(
          (r) =>
            r.rolsuper ||
            r.rolbypassrls ||
            r.rolcreatedb ||
            r.rolcreaterole ||
            (r.rolname === 'ourhoomu_core_writer' && r.rolcanlogin),
        ))
    )
      throw new Error('Refusing unknown or unsafe pre-existing core roles');
    const memberships = await client.query(
      "select 1 from pg_auth_members where member in (select oid from pg_roles where rolname in ('ourhoomu_core_app','ourhoomu_core_auth'))",
    );
    if (memberships.rows.length) throw new Error('Runtime roles have unexpected role memberships');
    const passwords = {
      app: reuse
        ? decodeURIComponent(new URL(secrets.CORE_APP_DATABASE_URL ?? '').password)
        : randomBytes(32).toString('hex'),
      auth: reuse
        ? decodeURIComponent(new URL(secrets.CORE_AUTH_DATABASE_URL ?? '').password)
        : randomBytes(32).toString('hex'),
    };
    await client.query('BEGIN');
    const journal = JSON.parse(
      readFileSync(new URL('../../drizzle/meta/_journal.json', import.meta.url), 'utf8'),
    ) as { entries: Array<{ tag: string }> };
    for (const { tag } of journal.entries) {
      if (!/^\d{4}_[a-z_]+$/.test(tag)) throw new Error('Invalid migration tag');
      const file = `${tag}.sql`;
      const sql = readFileSync(new URL(`../../drizzle/${file}`, import.meta.url), 'utf8');
      await client.query(sql);
      console.log(`${file} sha256=${createHash('sha256').update(sql).digest('hex')}`);
    }
    for (const role of ['app', 'auth'] as const) {
      if (!reuse)
        await client.query(`ALTER ROLE ourhoomu_core_${role} LOGIN PASSWORD '${passwords[role]}'`);
      const url = new URL(secrets.MIGRATION_DATABASE_URL ?? '');
      url.username = `ourhoomu_core_${role}`;
      url.password = passwords[role];
      url.hostname = url.hostname.replace(
        'ep-dry-breeze-b3e8t69s.',
        'ep-dry-breeze-b3e8t69s-pooler.',
      );
      secrets[`CORE_${role.toUpperCase()}_DATABASE_URL`] = url.toString();
    }
    await client.query('COMMIT');
    // Store only after successful commit. Existing entries are replaced without printing credentials.
    const { writeFileSync } = await import('node:fs');
    const lines = readFileSync(secretPath, 'utf8')
      .split('\n')
      .filter((line) => line && !/^CORE_(APP|AUTH)_DATABASE_URL=/.test(line));
    writeFileSync(secretPath, `${lines.join('\n')}\n`, { mode: 0o600 });
    appendFileSync(
      secretPath,
      `CORE_APP_DATABASE_URL=${secrets.CORE_APP_DATABASE_URL}\nCORE_AUTH_DATABASE_URL=${secrets.CORE_AUTH_DATABASE_URL}\n`,
    );
    console.log(
      'Core schema and separately restricted app/auth roles migrated; secrets stored mode600',
    );
  } else throw new Error('Usage: migrate.ts up|rollback');
  const after = await client.query<{ probe: string | null }>(
    "select to_regnamespace('runtime_probe')::text probe",
  );
  if (after.rows[0]?.probe !== probe) throw new Error('runtime_probe preservation check failed');
} catch (error) {
  await client.query('ROLLBACK');
  const code = error instanceof Error && 'code' in error ? String(error.code) : 'local';
  const message = error instanceof Error ? error.message : 'Unknown migration failure';
  console.error(`Migration failed [${code}]: ${message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
