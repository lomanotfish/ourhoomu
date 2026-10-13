export function assertSyntheticDbUrl(value: string, endpointId: string, expectedRole: string): void {
  if (!/^ep-[a-z0-9-]+$/.test(endpointId)) {
    throw new Error('Invalid synthetic endpoint identifier');
  }
  const url = new URL(value);
  const seen = new Set<string>();
  for (const [key] of url.searchParams) {
    if (!['sslmode', 'channel_binding'].includes(key) || seen.has(key)) {
      throw new Error('Database URL query overrides or duplicate parameters are forbidden');
    }
    seen.add(key);
  }
  const host = url.hostname.toLowerCase();
  const firstLabel = host.split('.')[0];
  const matchesEndpoint = firstLabel === endpointId || firstLabel === `${endpointId}-pooler`;
  if (
    url.protocol !== 'postgresql:' ||
    (url.port !== '' && url.port !== '5432') ||
    url.hash !== '' ||
    !host.endsWith('.neon.tech') ||
    !matchesEndpoint ||
    !['require', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '') ||
    url.username !== expectedRole ||
    !url.password
  ) {
    throw new Error('Database URL does not match the secure synthetic Neon endpoint and role');
  }
}
