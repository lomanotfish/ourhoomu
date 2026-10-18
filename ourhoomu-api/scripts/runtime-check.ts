const base = process.env.RUNTIME_BASE_URL;
if (!base) {
  throw new Error('RUNTIME_BASE_URL must point to the dedicated local workerd server');
}
const baseUrl = new URL(base);
if (baseUrl.protocol !== 'http:' || baseUrl.hostname !== '127.0.0.1') {
  throw new Error('RUNTIME_BASE_URL must use a loopback HTTP URL');
}
const fixture = process.argv.includes('--fixture');
const production = process.argv.includes('--production');
if (fixture === production) {
  throw new Error('select exactly one runtime mode: --fixture or --production');
}

export {};

interface JsonResponse {
  data?: { status?: string };
  requestId?: string;
  error?: { code?: string };
}

function assertEnvelope(
  body: JsonResponse | null,
  response: Response,
  expected: 'success' | { status: number; code: string },
) {
  if (typeof body?.requestId !== 'string' || !body.requestId) {
    throw new Error(`response is missing requestId (${response.status})`);
  }
  if (expected === 'success') {
    if (!response.ok || body.data?.status !== 'ok') {
      throw new Error(`health envelope failed (${response.status})`);
    }
    return;
  }
  if (response.status !== expected.status || body.error?.code !== expected.code) {
    throw new Error(`expected ${expected.status} ${expected.code} envelope (${response.status})`);
  }
}

async function check(
  path: string,
  init?: RequestInit,
): Promise<{ response: Response; body: JsonResponse | null }> {
  const response = await fetch(new URL(path, baseUrl), init);
  const body = (await response.json().catch(() => null)) as JsonResponse | null;
  return { response, body };
}

const health = await check('/health');
assertEnvelope(health.body, health.response, 'success');

if (fixture) {
  const validation = await check('/runtime/validate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer fixture' },
    body: JSON.stringify({ value: '' }),
  });
  assertEnvelope(validation.body, validation.response, { status: 400, code: 'validation_error' });

  const unauthenticated = await check('/runtime/validate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 'ok' }),
  });
  assertEnvelope(unauthenticated.body, unauthenticated.response, {
    status: 401,
    code: 'unauthenticated',
  });
} else if (production) {
  const proofRoute = await check('/runtime/validate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer arbitrary' },
    body: JSON.stringify({ value: 'ok' }),
  });
  assertEnvelope(proofRoute.body, proofRoute.response, { status: 404, code: 'not_found' });
  const unknown = await check('/not-a-route');
  assertEnvelope(unknown.body, unknown.response, { status: 404, code: 'not_found' });
}

const cors = await fetch(new URL('/health', baseUrl), {
  method: 'OPTIONS',
  headers: { origin: 'http://localhost:8081' },
});
if (
  cors.status !== 204 ||
  cors.headers.get('access-control-allow-origin') !== 'http://localhost:8081'
) {
  throw new Error(`CORS preflight failed (${cors.status})`);
}

console.log(
  fixture
    ? 'fixture workerd checks passed: health, validation 400, missing auth 401, CORS'
    : 'production workerd checks passed: health, proof route hidden 404, unknown route 404, CORS',
);
