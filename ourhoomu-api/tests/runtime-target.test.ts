import { describe, expect, it } from 'bun:test';
import { assertSyntheticDbUrl } from './fixtures/synthetic-target';

describe('synthetic Neon target guard', () => {
  const endpoint = 'ep-example-a1';
  const role = 'neondb_owner';
  const url = (host: string, sslmode = 'require') =>
    `postgresql://${role}:placeholder@${host}/neondb?sslmode=${sslmode}`;

  it('accepts only the exact endpoint DNS label on Neon', () => {
    expect(() =>
      assertSyntheticDbUrl(url(`${endpoint}.c-4.ap-southeast-1.aws.neon.tech`), endpoint, role),
    ).not.toThrow();
    expect(() =>
      assertSyntheticDbUrl(
        url(`${endpoint}-pooler.c-4.ap-southeast-1.aws.neon.tech`),
        endpoint,
        role,
      ),
    ).not.toThrow();
  });

  it('rejects lookalike hosts and insecure connections', () => {
    expect(() =>
      assertSyntheticDbUrl(
        url(`${endpoint}-attacker.c-4.ap-southeast-1.aws.neon.tech`),
        endpoint,
        role,
      ),
    ).toThrow();
    expect(() => assertSyntheticDbUrl(url(`${endpoint}.evil.example`), endpoint, role)).toThrow();
    expect(() =>
      assertSyntheticDbUrl(
        url(`${endpoint}.c-4.ap-southeast-1.aws.neon.tech`, 'disable'),
        endpoint,
        role,
      ),
    ).toThrow();
  });

  it('rejects driver query overrides and duplicate TLS values', () => {
    const base = url(`${endpoint}.c-4.ap-southeast-1.aws.neon.tech`);
    expect(() => assertSyntheticDbUrl(`${base}&host=evil.example`, endpoint, role)).toThrow();
    expect(() => assertSyntheticDbUrl(`${base}&sslmode=disable`, endpoint, role)).toThrow();
    expect(() => assertSyntheticDbUrl(`${base}&sslmode=require`, endpoint, role)).toThrow();
    expect(() => assertSyntheticDbUrl(`${base}&port=5432`, endpoint, role)).toThrow();
  });
});
