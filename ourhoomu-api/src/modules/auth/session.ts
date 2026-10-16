import { DataError, requestEvidence, type SessionStore } from '../../db/connection';
import type { components } from '@ourhoomu/contracts';
import { createIssuerAdapter, type IssuerAdapterOptions, type IssuerProvider } from './issuer';
import { digest, randomSecret, type ServerSecrets } from './secrets';

type Session = components['schemas']['Session'];
export type SessionOptions = {
  store: Pick<SessionStore, 'execute' | 'verifyAccessDigest'>;
  secrets: ServerSecrets;
  issuer: IssuerAdapterOptions;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  now?: () => number;
};
export function createSessions(options: SessionOptions) {
  if (
    !Number.isInteger(options.accessTtlSeconds) ||
    options.accessTtlSeconds < 1 ||
    options.accessTtlSeconds > 3600 ||
    !Number.isInteger(options.refreshTtlSeconds) ||
    options.refreshTtlSeconds < options.accessTtlSeconds ||
    options.refreshTtlSeconds > 31536000
  ) {
    throw new Error('Invalid session TTL configuration');
  }
  const { store, secrets } = options;
  const issuer = createIssuerAdapter(options.issuer);
  const now = options.now ?? Date.now;
  const nonce = (provider: IssuerProvider, id: string, proof: string) =>
    secrets.mac('challenge-nonce', [provider, id, proof]);
  const configured = (provider: IssuerProvider) => {
    const config = options.issuer.providers[provider];
    if (!config) throw new DataError('feature_unavailable');
    return config;
  };
  const credentials = () => ({ accessToken: randomSecret(), refreshToken: randomSecret() });
  const expiry = () => new Date(now() + options.accessTtlSeconds * 1000).toISOString();
  const session = async (tokens: {
    accessToken: string;
    refreshToken: string;
  }): Promise<Session> => {
    const actor = await store.verifyAccessDigest(await digest(tokens.accessToken));
    return { ...tokens, expiresAt: actor.expiresAt, userId: actor.userId };
  };
  return {
    secrets,
    async challenge(provider: IssuerProvider, clientNonce: string, key: string, exactBody: string) {
      configured(provider);
      const result = await store.execute('challenge', {
        ...(await requestEvidence(secrets.hmacKey, key, exactBody)),
        provider,
        proofDigest: await digest(clientNonce),
      });
      if (typeof result.challengeId !== 'string' || typeof result.expiresAt !== 'string')
        throw new DataError('internal_error');
      return {
        id: result.challengeId,
        provider,
        nonce: await nonce(provider, result.challengeId, clientNonce),
        expiresAt: result.expiresAt,
      };
    },
    async exchange(
      provider: IssuerProvider,
      challengeId: string,
      proof: string,
      idToken: string,
      key: string,
      exactBody: string,
    ) {
      const config = configured(provider);
      const evidence = await requestEvidence(secrets.hmacKey, key, exactBody);
      const proofDigest = await digest(proof);
      const binding = { provider, challengeId, proofDigest, ...evidence };
      const scope = JSON.stringify([
        provider,
        challengeId,
        proofDigest,
        evidence.keyDigest,
        evidence.bodyHash,
      ]);
      let result = await store.execute('exchange', { ...binding, checkReplay: true });
      if (result.pending === true) {
        const claims = await issuer.verifyIdToken({
          provider,
          idToken,
          expectedNonce: await nonce(provider, challengeId, proof),
          expectedAudience: config.audience,
        });
        const tokens = credentials();
        result = await store.execute('exchange', {
          ...binding,
          ...claims,
          displayName: 'Member',
          accessDigest: await digest(tokens.accessToken),
          refreshDigest: await digest(tokens.refreshToken),
          expiresAt: expiry(),
          refreshExpiresAt: new Date(now() + options.refreshTtlSeconds * 1000).toISOString(),
          replayCiphertext: await secrets.seal('exchange-replay', scope, tokens),
        });
      }
      if (typeof result.replayCiphertext !== 'string') throw new DataError('internal_error');
      const replay = await secrets.open('exchange-replay', scope, result.replayCiphertext);
      if (typeof replay.accessToken !== 'string' || typeof replay.refreshToken !== 'string')
        throw new DataError('internal_error');
      return session({ accessToken: replay.accessToken, refreshToken: replay.refreshToken });
    },
    async refresh(refreshToken: string, key: string, exactBody: string) {
      const evidence = await requestEvidence(secrets.hmacKey, key, exactBody);
      const refreshDigest = await digest(refreshToken);
      const scope = JSON.stringify([refreshDigest, evidence.keyDigest, evidence.bodyHash]);
      const tokens = credentials();
      const replayCiphertext = await secrets.seal('session-replay', scope, tokens);
      const result = await store.execute('rotate', {
        refreshDigest,
        ...evidence,
        nextAccessDigest: await digest(tokens.accessToken),
        nextRefreshDigest: await digest(tokens.refreshToken),
        expiresAt: expiry(),
        replayCiphertext,
      });
      if (typeof result.replayCiphertext !== 'string') throw new DataError('internal_error');
      const replay = await secrets.open('session-replay', scope, result.replayCiphertext);
      if (typeof replay.accessToken !== 'string' || typeof replay.refreshToken !== 'string')
        throw new DataError('internal_error');
      return session({ accessToken: replay.accessToken, refreshToken: replay.refreshToken });
    },
    async authenticate(authorization: string | null) {
      if (!authorization || !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))
        throw new DataError('unauthenticated');
      return store.verifyAccessDigest(await digest(authorization.slice(7)));
    },
  };
}
export type Sessions = ReturnType<typeof createSessions>;
