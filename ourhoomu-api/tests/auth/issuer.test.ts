import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { describe, expect, it } from 'bun:test';
import { createIssuerAdapter, IssuerVerificationError } from '../../src/modules/auth/issuer';

const issuer = 'https://accounts.example.test';
const audience = 'ourhoomu-ios';
const jwksUrl = 'https://keys.example.test/jwks';
const now = Math.floor(Date.now() / 1000);

async function key(kid: string) {
  const pair = await generateKeyPair('RS256');
  return {
    pair,
    jwk: { ...(await exportJWK(pair.publicKey)), kid, alg: 'RS256', use: 'sig' } as JWK,
  };
}

async function token(
  privateKey: CryptoKey,
  overrides: Record<string, unknown> = {},
  kid = 'key-1',
) {
  const claims: Record<string, unknown> = {
    iss: issuer,
    aud: audience,
    sub: 'subject-123',
    nonce: 'nonce-expected',
    auth_time: now - 30,
    ...overrides,
  };
  const jwt = new SignJWT(claims)
    .setProtectedHeader({
      alg: 'RS256',
      kid,
      jku: 'http://attacker.test/jwks',
      x5u: 'http://attacker.test/cert',
    })
    .setIssuedAt(now);
  if (typeof claims.exp === 'number') jwt.setExpirationTime(claims.exp);
  else if (!Object.hasOwn(overrides, 'exp')) jwt.setExpirationTime(now + 300);
  if (typeof claims.nbf === 'number') jwt.setNotBefore(claims.nbf);
  return jwt.sign(privateKey);
}

function adapter(load: () => Promise<{ keys: JWK[] }>, overrides: Record<string, unknown> = {}) {
  return createIssuerAdapter({
    providers: { google: { issuer, audience, jwksUrl, algorithms: ['RS256'], ...overrides } },
    getJwks: load,
    now: () => now * 1000,
  });
}

async function verify(instance: ReturnType<typeof adapter>, idToken: string) {
  return instance.verifyIdToken({
    provider: 'google',
    idToken,
    expectedNonce: 'nonce-expected',
    expectedAudience: audience,
  });
}

describe('issuer adapter', () => {
  it('verifies signed claims and returns only issuer, subject, and authentication time', async () => {
    const signingKey = await key('key-1');
    const idToken = await token(signingKey.pair.privateKey);
    const result = await verify(
      adapter(async () => ({ keys: [signingKey.jwk] })),
      idToken,
    );
    expect(result).toEqual({
      issuer,
      subject: 'subject-123',
      authTime: new Date((now - 30) * 1000).toISOString(),
    });
  });

  it('rejects a token signed by an unknown key', async () => {
    const signingKey = await key('wrong-key');
    const idToken = await token(signingKey.pair.privateKey, {}, 'key-1');
    await expect(
      verify(
        adapter(async () => ({ keys: [(await key('key-1')).jwk] })),
        idToken,
      ),
    ).rejects.toBeInstanceOf(IssuerVerificationError);
  });

  it('uses refreshed trusted keys after rotation', async () => {
    const first = await key('key-1');
    const rotated = await key('key-2');
    let keys: JWK[] = [first.jwk];
    const instance = adapter(async () => ({ keys }));
    expect(await verify(instance, await token(first.pair.privateKey, {}, 'key-1'))).toHaveProperty(
      'subject',
      'subject-123',
    );
    keys = [rotated.jwk];
    expect(
      await verify(instance, await token(rotated.pair.privateKey, {}, 'key-2')),
    ).toHaveProperty('subject', 'subject-123');
  });

  it.each([
    ['wrong issuer', { iss: 'https://attacker.test' }],
    ['wrong audience', { aud: 'other-app' }],
    ['wrong nonce', { nonce: 'other-nonce' }],
    ['expired', { exp: now - 120 }],
    ['future not-before', { nbf: now + 120 }],
    ['missing subject', { sub: undefined }],
    ['missing nonce', { nonce: undefined }],
    ['missing auth time', { auth_time: undefined }],
    ['missing expiry', { exp: undefined }],
    ['stale authentication time', { auth_time: now - 600 }],
    ['future authentication time', { auth_time: now + 61 }],
  ])('rejects %s', async (_case, claims) => {
    const signingKey = await key('key-1');
    const idToken = await token(signingKey.pair.privateKey, claims);
    await expect(
      verify(
        adapter(async () => ({ keys: [signingKey.jwk] })),
        idToken,
      ),
    ).rejects.toBeInstanceOf(IssuerVerificationError);
  });

  it('rejects an algorithm outside trusted policy', async () => {
    const signingKey = await key('key-1');
    const idToken = await new SignJWT({
      iss: issuer,
      aud: audience,
      sub: 'subject-123',
      nonce: 'nonce-expected',
      auth_time: now - 30,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(signingKey.pair.privateKey);
    await expect(
      verify(
        adapter(async () => ({ keys: [signingKey.jwk] }), { algorithms: ['ES256'] }),
        idToken,
      ),
    ).rejects.toBeInstanceOf(IssuerVerificationError);
  });

  it('fails closed for an unconfigured provider and audience override', async () => {
    const instance = adapter(async () => ({ keys: [] }));
    const idToken = 'secret-token';
    await expect(
      instance.verifyIdToken({
        provider: 'apple',
        idToken,
        expectedNonce: 'n',
        expectedAudience: audience,
      }),
    ).rejects.toBeInstanceOf(IssuerVerificationError);
    await expect(
      instance.verifyIdToken({
        provider: 'google',
        idToken,
        expectedNonce: 'n',
        expectedAudience: 'attacker-app',
      }),
    ).rejects.toBeInstanceOf(IssuerVerificationError);
  });

  it('does not fetch URLs from attacker-controlled jku or x5u headers', async () => {
    const signingKey = await key('key-1');
    const fetched: string[] = [];
    const instance = createIssuerAdapter({
      providers: { google: { issuer, audience, jwksUrl, algorithms: ['RS256'] } },
      getJwks: async (url) => {
        fetched.push(url);
        return { keys: [signingKey.jwk] };
      },
      now: () => now * 1000,
    });
    await verify(instance, await token(signingKey.pair.privateKey));
    expect(fetched).toEqual([jwksUrl]);
  });

  it('rejects malformed trusted configuration before fetching keys', async () => {
    let fetched = false;
    const instance = createIssuerAdapter({
      providers: {
        google: { issuer, audience, jwksUrl: 'http://untrusted.test/jwks', algorithms: [] },
      },
      getJwks: async () => {
        fetched = true;
        return { keys: [] };
      },
    });
    await expect(
      instance.verifyIdToken({
        provider: 'google',
        idToken: 'secret-token',
        expectedNonce: 'n',
        expectedAudience: audience,
      }),
    ).rejects.toBeInstanceOf(IssuerVerificationError);
    expect(fetched).toBe(false);
  });

  it('rejects missing trusted provider configuration', async () => {
    const instance = createIssuerAdapter({ providers: {}, getJwks: async () => ({ keys: [] }) });
    await expect(
      instance.verifyIdToken({
        provider: 'google',
        idToken: 'secret-token',
        expectedNonce: 'n',
        expectedAudience: audience,
      }),
    ).rejects.toBeInstanceOf(IssuerVerificationError);
  });
});
