import { expect, test } from 'bun:test';
import { validateCoreTarget } from '../../scripts/db/target';
const secrets = {
  ALLOW_SYNTHETIC_DB: 'true',
  APP_ENV: 'test',
  NEON_PROJECT_ID: 'lucky-bar-14515304',
  NEON_BRANCH_ID: 'br-weathered-thunder-b38dgxbm',
  NEON_ENDPOINT_ID: 'ep-dry-breeze-b3e8t69s',
  MIGRATION_DATABASE_URL:
    'postgresql://neondb_owner:fake@ep-dry-breeze-b3e8t69s.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
};
const receipt = {
  branch: {
    id: secrets.NEON_BRANCH_ID,
    project_id: secrets.NEON_PROJECT_ID,
    name: 'dev-core-sw0036-20261013',
    init_source: 'parent-schema',
    expires_at: '2026-10-20T12:00:00Z',
  },
  endpoints: [
    {
      id: secrets.NEON_ENDPOINT_ID,
      branch_id: secrets.NEON_BRANCH_ID,
      project_id: secrets.NEON_PROJECT_ID,
    },
  ],
};
test('exact target only, direct owner migration and restricted separate runtime', () => {
  expect(() => validateCoreTarget(secrets, receipt, new Date('2026-10-14'))).not.toThrow();
  for (const patch of [
    { NEON_BRANCH_ID: 'production' },
    { NEON_PROJECT_ID: 'other' },
    {
      MIGRATION_DATABASE_URL: secrets.MIGRATION_DATABASE_URL.replace(
        'ep-dry-breeze-b3e8t69s.',
        'ep-dry-breeze-b3e8t69s-pooler.',
      ),
    },
    { MIGRATION_DATABASE_URL: `${secrets.MIGRATION_DATABASE_URL}&options=unsafe` },
  ])
    expect(() =>
      validateCoreTarget({ ...secrets, ...patch }, receipt, new Date('2026-10-14')),
    ).toThrow();
  expect(() => validateCoreTarget(secrets, receipt, new Date('2026-10-21'))).toThrow();
});
