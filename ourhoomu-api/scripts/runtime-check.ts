const base = process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:8787';

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

const validation = await check('/runtime/validate', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer fixture' }, body: JSON.stringify({ value: '' }),
});
if (validation.response.status !== 400 || validation.body?.error?.code !== 'validation_error') {
  throw new Error(`validation envelope failed (${validation.response.status})`);
}

const unauthorized = await check('/runtime/validate', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'ok' }),
});
if (unauthorized.response.status !== 401 || unauthorized.body?.error?.code !== 'unauthenticated') {
  throw new Error(`unauthorized envelope failed (${unauthorized.response.status})`);
}

const cors = await fetch(new URL('/health', base), { method: 'OPTIONS', headers: { origin: 'http://localhost:8081' } });
if (cors.status !== 204 || cors.headers.get('access-control-allow-origin') !== 'http://localhost:8081') {
  throw new Error(`CORS preflight failed (${cors.status})`);
}

console.log('runtime checks passed: workerd target supplied by caller; health, validation 400, missing auth 401, CORS');
