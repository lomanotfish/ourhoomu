export function assertSyntheticDbUrl(value: string, endpointId: string, expectedRole: string): void {
  if (!/^ep-[a-z0-9-]+$/.test(endpointId)) {
    throw new Error('Invalid synthetic endpoint identifier');
  }
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const firstLabel = host.split('.')[0];
  const matchesEndpoint = firstLabel === endpointId || firstLabel === `${endpointId}-pooler`;
  if (
    url.protocol !== 'postgresql:' ||
    !host.endsWith('.neon.tech') ||
    !matchesEndpoint ||
    !['require', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '') ||
    url.username !== expectedRole ||
    !url.password
  ) {
    throw new Error('Database URL does not match the secure synthetic Neon endpoint and role');
  }
}
