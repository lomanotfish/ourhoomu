/** Explicit synthetic acceptance server. Never imported by the Worker entrypoint. */
import { readFileSync, statSync } from 'node:fs';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { loadTarget } from '../../scripts/db/target';
import { readCoreConfig, type CoreBindings } from '../../src/modules/core/config';
import { createRuntimeApp } from '../../src/modules/core/runtime';

if (process.env.ALLOW_CORE_HTTP_ACCEPTANCE !== 'true')
  throw new Error('Explicit exclusive-window grant required');
const file = process.env.CORE_HTTP_BINDINGS_FILE;
if (!file || (statSync(file).mode & 0o777) !== 0o600)
  throw new Error('Explicit mode600 CORE_HTTP_BINDINGS_FILE required');
const values: Record<string, string> = {};
for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
  const index = line.indexOf('=');
  if (index < 1 || Object.hasOwn(values, line.slice(0, index)))
    throw new Error('Malformed binding file');
  values[line.slice(0, index)] = line.slice(index + 1);
}
const { secrets } = loadTarget();
if (
  values.CORE_APP_DATABASE_URL !== secrets.CORE_APP_DATABASE_URL ||
  values.CORE_AUTH_DATABASE_URL !== secrets.CORE_AUTH_DATABASE_URL
)
  throw new Error('Binding connections differ from guarded synthetic target');
const bindings: CoreBindings = values;
const config = readCoreConfig(bindings);
const provider = config.providers.google;
if (
  !provider ||
  Object.keys(config.providers).length !== 1 ||
  provider.issuer !== 'https://synthetic.invalid' ||
  provider.jwksUrl !== 'https://synthetic.invalid/jwks' ||
  provider.audience !== 'core-http-acceptance' ||
  provider.algorithms.join() !== 'RS256'
)
  throw new Error('Explicit synthetic issuer config required');
const pair = await generateKeyPair('RS256');
const publicJwk = {
  ...(await exportJWK(pair.publicKey)),
  kid: 'synthetic-http',
  alg: 'RS256',
  use: 'sig',
};
let issuerTimeOffset = 0;
const app = await createRuntimeApp(
  { appEnv: 'test', allowedOrigin: 'http://localhost:8081' },
  bindings,
  {
    getJwks: async (trustedUrl) => {
      if (trustedUrl !== provider.jwksUrl) throw new Error('Untrusted fixture JWKS');
      return { keys: [publicJwk] };
    },
    now: () => Date.now() + issuerTimeOffset,
  },
);
const port = Number(process.env.CORE_HTTP_PORT ?? '18765');
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Invalid local acceptance port');
Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/__synthetic/token' && request.method === 'POST') {
      const input = (await request.json()) as {
        nonce: string;
        subject: string;
        expiresInSeconds?: number;
        email?: string;
      };
      if (
        typeof input.nonce !== 'string' ||
        typeof input.subject !== 'string' ||
        input.subject.length > 200
      )
        return new Response(null, { status: 400 });
      const ttl = input.expiresInSeconds ?? 300;
      if (!Number.isInteger(ttl) || ttl < -300 || ttl > 300)
        return new Response(null, { status: 400 });
      const token = await new SignJWT({
        nonce: input.nonce,
        auth_time: Math.floor(Date.now() / 1000),
        ...(input.email ? { email: input.email, email_verified: true } : {}),
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'synthetic-http' })
        .setIssuer(provider.issuer)
        .setAudience(provider.audience)
        .setSubject(input.subject)
        .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
        .sign(pair.privateKey);
      return Response.json({ idToken: token }, { headers: { 'cache-control': 'no-store' } });
    }
    if (path === '/__synthetic/issuer-clock' && request.method === 'POST') {
      const input = (await request.json()) as { advanceSeconds: number };
      if (
        !Number.isInteger(input.advanceSeconds) ||
        input.advanceSeconds < 0 ||
        input.advanceSeconds > 600
      )
        return new Response(null, { status: 400 });
      issuerTimeOffset = input.advanceSeconds * 1000;
      return Response.json({ advanced: true });
    }
    return app.fetch(request);
  },
});
console.log(`Synthetic core HTTP acceptance listening on loopback port ${port}`);
