import { createLocalJWKSet, jwtVerify, type JWK, type JWTPayload } from 'jose';

export type IssuerProvider = 'google' | 'apple';

type TrustedIssuerConfig = Readonly<{
  issuer: string;
  audience: string;
  jwksUrl: string;
  algorithms: readonly string[];
  trustedPresenters?: readonly string[];
}>;

type IssuerAdapterOptions = Readonly<{
  providers: Partial<Record<IssuerProvider, TrustedIssuerConfig>>;
  getJwks: (trustedUrl: string) => Promise<{ keys: JWK[] }>;
  now?: () => number;
}>;

type VerifyInput = Readonly<{
  provider: IssuerProvider;
  idToken: string;
  expectedNonce: string;
  expectedAudience: string;
}>;

type VerifiedClaims = Readonly<{ issuer: string; subject: string; authTime: string }>;

const MAX_AUTH_AGE_SECONDS = 300;
const AUTH_TIME_FUTURE_TOLERANCE_SECONDS = 60;

export class IssuerVerificationError extends Error {
  constructor() {
    super('Identity token could not be verified');
    this.name = 'IssuerVerificationError';
  }
}

function validConfig(config: TrustedIssuerConfig | undefined): config is TrustedIssuerConfig {
  if (
    !config ||
    typeof config.issuer !== 'string' ||
    !config.issuer ||
    typeof config.audience !== 'string' ||
    !config.audience ||
    typeof config.jwksUrl !== 'string' ||
    !config.jwksUrl ||
    !Array.isArray(config.algorithms) ||
    config.algorithms.length === 0 ||
    config.algorithms.some((algorithm) => typeof algorithm !== 'string' || !algorithm) ||
    (config.trustedPresenters !== undefined &&
      (!Array.isArray(config.trustedPresenters) ||
        config.trustedPresenters.some((presenter) => typeof presenter !== 'string' || !presenter)))
  )
    return false;
  try {
    const url = new URL(config.jwksUrl);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

function validateAudienceAndPresenter(payload: JWTPayload, config: TrustedIssuerConfig): void {
  const audience = Array.isArray(payload.aud)
    ? payload.aud.length === 1 && payload.aud[0] === config.audience
    : payload.aud === config.audience;
  if (
    !audience ||
    (Object.hasOwn(payload, 'azp') &&
      (typeof payload.azp !== 'string' ||
        !payload.azp ||
        !config.trustedPresenters?.includes(payload.azp)))
  ) {
    throw new IssuerVerificationError();
  }
}

function requiredClaims(payload: JWTPayload, nonce: string, nowSeconds: number): VerifiedClaims {
  if (
    typeof payload.iss !== 'string' ||
    typeof payload.sub !== 'string' ||
    payload.sub.length === 0 ||
    typeof payload.nonce !== 'string' ||
    payload.nonce !== nonce ||
    typeof payload.auth_time !== 'number' ||
    !Number.isFinite(payload.auth_time) ||
    payload.auth_time > nowSeconds + AUTH_TIME_FUTURE_TOLERANCE_SECONDS ||
    payload.auth_time < nowSeconds - MAX_AUTH_AGE_SECONDS ||
    !Number.isFinite(payload.exp)
  ) {
    throw new IssuerVerificationError();
  }
  return {
    issuer: payload.iss,
    subject: payload.sub,
    authTime: new Date(payload.auth_time * 1000).toISOString(),
  };
}

export function createIssuerAdapter(options: IssuerAdapterOptions) {
  const now = options.now ?? Date.now;

  return {
    async verifyIdToken(input: VerifyInput): Promise<VerifiedClaims> {
      const config = options.providers[input.provider];
      if (
        !validConfig(config) ||
        !input.idToken ||
        !input.expectedNonce ||
        input.expectedAudience !== config.audience
      ) {
        throw new IssuerVerificationError();
      }

      try {
        const jwks = await options.getJwks(config.jwksUrl);
        const keySet = createLocalJWKSet(jwks);
        const { payload } = await jwtVerify(input.idToken, keySet, {
          algorithms: [...config.algorithms],
          issuer: config.issuer,
          audience: config.audience,
          requiredClaims: ['iss', 'aud', 'sub', 'exp', 'nonce', 'auth_time'],
          currentDate: new Date(now()),
          clockTolerance: 60,
        });
        validateAudienceAndPresenter(payload, config);
        return requiredClaims(payload, input.expectedNonce, Math.floor(now() / 1000));
      } catch {
        throw new IssuerVerificationError();
      }
    },
  };
}

export async function fetchTrustedJwks(trustedUrl: string): Promise<{ keys: JWK[] }> {
  try {
    const url = new URL(trustedUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error();
    const response = await fetch(url, { redirect: 'error' });
    if (!response.ok) throw new Error();
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !Array.isArray((body as { keys?: unknown }).keys))
      throw new Error();
    return body as { keys: JWK[] };
  } catch {
    throw new IssuerVerificationError();
  }
}
