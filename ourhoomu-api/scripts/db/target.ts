import { readFileSync, statSync } from 'node:fs';
import { assertSyntheticDbUrl } from '../../tests/fixtures/synthetic-target';

export const TARGET = {
  project: 'lucky-bar-14515304',
  branch: 'br-weathered-thunder-b38dgxbm',
  endpoint: 'ep-dry-breeze-b3e8t69s',
} as const;
export type Receipt = {
  branch: { id: string; project_id: string; name: string; init_source: string; expires_at: string };
  endpoints: Array<{ id: string; branch_id: string; project_id: string }>;
};
export function validateCoreTarget(
  secrets: Record<string, string>,
  receipt: Receipt,
  now = new Date(),
) {
  if (
    secrets.ALLOW_SYNTHETIC_DB !== 'true' ||
    secrets.APP_ENV !== 'test' ||
    secrets.NEON_PROJECT_ID !== TARGET.project ||
    secrets.NEON_BRANCH_ID !== TARGET.branch ||
    secrets.NEON_ENDPOINT_ID !== TARGET.endpoint ||
    receipt.branch.id !== TARGET.branch ||
    receipt.branch.project_id !== TARGET.project ||
    receipt.branch.name !== 'dev-core-sw0036-20261013' ||
    receipt.branch.init_source !== 'parent-schema' ||
    !Number.isFinite(Date.parse(receipt.branch.expires_at)) ||
    Date.parse(receipt.branch.expires_at) <= now.getTime() ||
    now.getTime() >= Date.parse('2026-10-20T12:00:00Z') ||
    !receipt.endpoints.some(
      (e) =>
        e.id === TARGET.endpoint &&
        e.branch_id === TARGET.branch &&
        e.project_id === TARGET.project,
    )
  )
    throw new Error('Refusing core DB access: exact authorized synthetic target/expiry differs');
  assertSyntheticDbUrl(secrets.MIGRATION_DATABASE_URL ?? '', TARGET.endpoint, 'neondb_owner');
  if (new URL(secrets.MIGRATION_DATABASE_URL ?? '').hostname.split('.')[0] !== TARGET.endpoint)
    throw new Error('Migrations require the direct owner endpoint');
  for (const [key, role] of [
    ['CORE_APP_DATABASE_URL', 'ourhoomu_core_app'],
    ['CORE_AUTH_DATABASE_URL', 'ourhoomu_core_auth'],
  ] as const)
    if (secrets[key]) assertSyntheticDbUrl(secrets[key], TARGET.endpoint, role);
}
/** Explicit paths only. Never uses DATABASE_URL, linked root env, or Neon config. */
export function loadTarget() {
  const secretPath = process.env.SYNTHETIC_DB_ENV_FILE;
  const receiptPath = process.env.NEON_BRANCH_RECEIPT;
  if (!secretPath || !receiptPath)
    throw new Error('Set explicit SYNTHETIC_DB_ENV_FILE and NEON_BRANCH_RECEIPT');
  if ((statSync(secretPath).mode & 0o777) !== 0o600)
    throw new Error('Synthetic credential file must be mode600');
  const secrets: Record<string, string> = {};
  for (const line of readFileSync(secretPath, 'utf8').split('\n').filter(Boolean)) {
    const i = line.indexOf('=');
    if (i < 1 || secrets[line.slice(0, i)])
      throw new Error('Malformed or duplicate private env key');
    secrets[line.slice(0, i)] = line.slice(i + 1);
  }
  validateCoreTarget(secrets, JSON.parse(readFileSync(receiptPath, 'utf8')) as Receipt);
  return { secrets, secretPath };
}
