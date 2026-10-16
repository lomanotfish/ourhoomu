/** In-process synthetic authority, not database/provider acceptance. No network calls. */
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { DataError, type VerifiedPrincipal } from '../../src/db/connection';
import { createSecrets } from '../../src/modules/auth/secrets';
import { createSessions, type SessionOptions } from '../../src/modules/auth/session';

type Row = Record<string, unknown>;
export async function sessionFixture() {
  let time = Date.now();
  const challenges = new Map<string, Row>();
  const challengeKeys = new Map<string, Row>();
  const access = new Map<string, Row>();
  const refresh = new Map<string, Row>();
  const pair = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'synthetic', alg: 'RS256' };
  const issuer = 'https://synthetic.invalid';
  const userId = crypto.randomUUID();
  const state = { failure: '', lastInput: {} as Row };
  const store: SessionOptions['store'] = {
    async execute(op, input) {
      if (state.failure) throw new DataError(state.failure, 7);
      state.lastInput = input;
      if (op === 'challenge') {
        const old = challengeKeys.get(String(input.keyDigest));
        if (old) {
          if (old.bodyHash !== input.bodyHash) throw new DataError('idempotency_conflict');
          return { challengeId: old.challengeId, expiresAt: old.expiresAt, replayed: true };
        }
        const challengeId = crypto.randomUUID();
        const expiresAt = new Date(time + 300000).toISOString();
        const row = { ...input, challengeId, expiresAt, consumed: false };
        challenges.set(challengeId, row);
        challengeKeys.set(String(input.keyDigest), row);
        return { challengeId, expiresAt, replayed: false };
      }
      if (op === 'exchange') {
        const challenge = challenges.get(String(input.challengeId));
        if (
          !challenge ||
          challenge.provider !== input.provider ||
          challenge.proofDigest !== input.proofDigest
        )
          throw new DataError('unauthenticated');
        if (challenge.consumed) {
          if (
            challenge.exchangeKey === input.keyDigest &&
            challenge.exchangeBody !== input.bodyHash
          )
            throw new DataError('idempotency_conflict');
          if (challenge.exchangeKey !== input.keyDigest || Number(challenge.replayUntil) <= time)
            throw new DataError('unauthenticated');
          return { replayed: true, replayCiphertext: challenge.replayCiphertext };
        }
        if (String(challenge.expiresAt) <= new Date(time).toISOString())
          throw new DataError('unauthenticated');
        if (input.checkReplay) return { pending: true };
        Object.assign(challenge, {
          consumed: true,
          exchangeKey: input.keyDigest,
          exchangeBody: input.bodyHash,
          replayCiphertext: input.replayCiphertext,
          replayUntil: time + 300000,
        });
        const row = { ...input, userId, sessionId: crypto.randomUUID(), revoked: false };
        access.set(String(input.accessDigest), row);
        refresh.set(String(input.refreshDigest), row);
        return { replayed: false, replayCiphertext: input.replayCiphertext };
      }
      if (op === 'rotate') {
        const old = refresh.get(String(input.refreshDigest));
        if (!old || old.revoked || String(old.refreshExpiresAt) <= new Date(time).toISOString())
          throw new DataError('unauthenticated');
        if (old.rotated) {
          if (
            old.keyDigest === input.keyDigest &&
            old.bodyHash === input.bodyHash &&
            Number(old.replayUntil) > time
          )
            return { replayCiphertext: old.replayCiphertext };
          for (const row of access.values()) row.revoked = true;
          throw new DataError('unauthenticated');
        }
        Object.assign(old, {
          rotated: true,
          keyDigest: input.keyDigest,
          bodyHash: input.bodyHash,
          replayCiphertext: input.replayCiphertext,
          replayUntil: time + 300000,
        });
        const next = {
          ...old,
          ...input,
          rotated: false,
          sessionId: crypto.randomUUID(),
          expiresAt: new Date(
            Math.min(Date.parse(String(input.expiresAt)), Date.parse(String(old.refreshExpiresAt))),
          ).toISOString(),
        };
        access.set(String(input.nextAccessDigest), next);
        refresh.set(String(input.nextRefreshDigest), next);
        return { replayCiphertext: input.replayCiphertext };
      }
      if (op === 'revoke') {
        for (const row of access.values()) row.revoked = true;
        return { revoked: true };
      }
      throw new Error('Unexpected fixture operation');
    },
    async verifyAccessDigest(value) {
      const row = access.get(value);
      if (
        !row ||
        row.revoked ||
        row.rotated ||
        String(row.expiresAt) <= new Date(time).toISOString()
      )
        throw new DataError('unauthenticated');
      return {
        ...row,
        issuer,
        subject: 'synthetic-subject',
        authTime: new Date(time).toISOString(),
      } as unknown as VerifiedPrincipal;
    },
  };
  const secrets = await createSecrets('aa'.repeat(32), 'bb'.repeat(32), 1);
  const sessions = createSessions({
    store,
    secrets,
    accessTtlSeconds: 900,
    refreshTtlSeconds: 2592000,
    issuer: {
      providers: {
        google: {
          issuer,
          audience: 'test-ios',
          jwksUrl: 'https://keys.invalid/jwks',
          algorithms: ['RS256'],
        },
      },
      getJwks: async () => ({ keys: [jwk] }),
      now: () => time,
    },
    now: () => time,
  });
  return {
    sessions,
    state,
    userId,
    advance: (milliseconds: number) => {
      time += milliseconds;
    },
    async token(nonce: string, overrides: Row = {}) {
      return new SignJWT({ nonce, auth_time: Math.floor(time / 1000), ...overrides })
        .setProtectedHeader({ alg: 'RS256', kid: 'synthetic' })
        .setIssuer(issuer)
        .setAudience('test-ios')
        .setSubject('synthetic-subject')
        .setExpirationTime(
          typeof overrides.exp === 'number' ? overrides.exp : Math.floor(time / 1000) + 300,
        )
        .sign(pair.privateKey);
    },
  };
}
