const base = process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:8787';
const fixture = process.argv.includes('--fixture');

export {};

interface JsonResponse {
  data?: { status?: string };
  requestId?: string;
  error?: { code?: string };
}

async function check(path: string, init?: RequestInit): Promise<{ response: Response; body: JsonResponse | null }> {
  const response = await fetch(new URL(path, base), init);
  const body = await response.json().catch(() => null) as JsonResponse | null;
  return { response, body };
}

const health = await check('/health');
if (!health.response.ok || health.body?.data?.status !== 'ok' || typeof health.body?.requestId !== 'string') {
  throw new Error(`health failed (${health.response.status})`);
}

if (fixture) {
  const validation = await check('/runtime/validate', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer fixture' }, body: JSON.stringify({ value: '' }),
  });
  if (validation.response.status !== 400 || validation.body?.error?.code !== 'validation_error') {
    throw new Error(`validation envelope failed (${validation.response.status})`);
  }

  const unauthenticated = await check('/runtime/validate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'ok' }),
  });
  if (unauthenticated.response.status !== 401 || unauthenticated.body?.error?.code !== 'unauthenticated') {
    throw new Error(`unauthenticated envelope failed (${unauthenticated.response.status})`);
  }
} else {
  const proofRoute = await check('/runtime/validate', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer arbitrary' }, body: JSON.stringify({ value: 'ok' }),
  });
  if (proofRoute.response.status !== 404 || proofRoute.body?.error?.code !== 'not_found') {
    throw new Error(`production proof route is exposed (${proofRoute.response.status})`);
  }
  const unknown = await check('/not-a-route');
  if (unknown.response.status !== 404 || unknown.body?.error?.code !== 'not_found') {
    throw new Error(`unknown route did not return 404 (${unknown.response.status})`);
  }
}

const cors = await fetch(new URL('/health', base), { method: 'OPTIONS', headers: { origin: 'http://localhost:8081' } });
if (cors.status !== 204 || cors.headers.get('access-control-allow-origin') !== 'http://localhost:8081') {
  throw new Error(`CORS preflight failed (${cors.status})`);
}

console.log(fixture
  ? 'fixture workerd checks passed: health, validation 400, missing auth 401, CORS'
  : 'production workerd checks passed: health, proof route hidden 404, unknown route 404, CORS');
