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
  } else if (mode === 'patch-http-seam' || mode === 'rollback-http-seam') {
    if (!before.rows[0]?.core) throw new Error('HTTP seam requires accepted existing core');
    const sql = readFileSync(new URL('../../drizzle/0003_http_seam.sql', import.meta.url), 'utf8');
    const sha = createHash('sha256').update(sql).digest('hex');
    await client.query('BEGIN');
    await client.query("select pg_advisory_xact_lock(hashtextextended('http-seam-migration',0))");
    const state = await client.query(
      "select to_regclass('core.http_seam_migration_state') is not null applied",
    );
    const fingerprint = async () =>
      (
        await client.query(
          `select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))) hashes from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='core' and p.proname in ('command','auth_command','auth_command_before_http','http_projection','clear_replay_secrets')`,
        )
      ).rows[0]?.hashes;
    if (state.rows[0]?.applied) {
      const row = (await client.query('select * from core.http_seam_migration_state')).rows[0];
      const hashes = await fingerprint();
      if (
        row?.migration_sha !== sha ||
        JSON.stringify(row.applied_hashes) !== JSON.stringify(hashes)
      )
        throw new Error('Refusing unknown HTTP seam migration or changed function definitions');
      if (mode === 'rollback-http-seam') {
        const occupied = await client.query(
          'select exists(select 1 from core.auth_request_locators) or exists(select 1 from core.idempotency_records where result_data is not null) occupied',
        );
        if (occupied.rows[0]?.occupied)
          throw new Error('Refusing rollback with retained HTTP replay data');
        await client.query(row.command_definition);
        await client.query(row.clear_definition);
        await client.query('DROP FUNCTION core.auth_command(text,jsonb)');
        await client.query(
          'ALTER FUNCTION core.auth_command_before_http(text,jsonb) RENAME TO auth_command',
        );
        await client.query(
          'GRANT EXECUTE ON FUNCTION core.auth_command(text,jsonb) TO ourhoomu_core_auth',
        );
        await client.query('DROP FUNCTION core.http_projection(text,uuid,uuid)');
        await client.query('ALTER TABLE core.idempotency_records DROP COLUMN result_data');
        await client.query('DROP TABLE core.auth_request_locators,core.http_seam_migration_state');
        console.log(
          'HTTP seam rollback restored accepted functions; roles and runtime_probe preserved',
        );
      } else console.log('HTTP seam reapply verified exact migration and function hashes; no-op');
    } else {
      if (mode === 'rollback-http-seam')
        throw new Error('Refusing rollback: HTTP seam not applied');
      await client.query(sql);
      await client.query(
        'update core.http_seam_migration_state set migration_sha=$1,applied_hashes=$2::jsonb',
        [sha, JSON.stringify(await fingerprint())],
      );
      console.log(`0003_http_seam.sql sha256=${sha}`);
    }
    await client.query('COMMIT');
  } else if (mode === 'patch-house-timezone') {
    if (!before.rows[0]?.core) throw new Error('Core schema missing; run guarded up first');
    const sql = readFileSync(
      new URL('../../drizzle/0002_house_timezone.sql', import.meta.url),
      'utf8',
    );
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`0002_house_timezone.sql sha256=${createHash('sha256').update(sql).digest('hex')}`);
    console.log('Additive house timezone patch committed; schema, roles and fixtures retained');
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
    await client.query(
      `update core.http_seam_migration_state set migration_sha=$1,applied_hashes=(select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='core' and p.proname in ('command','auth_command','auth_command_before_http','http_projection','clear_replay_secrets'))`,
      [
        createHash('sha256')
          .update(
            readFileSync(new URL('../../drizzle/0003_http_seam.sql', import.meta.url), 'utf8'),
          )
          .digest('hex'),
      ],
    );
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
  } else
    throw new Error(
      'Usage: migrate.ts up|patch-house-timezone|patch-http-seam|rollback-http-seam|rollback',
    );
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
