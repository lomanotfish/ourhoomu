import type { components } from '../api/dto';
import type { FetchFunction, SessionTransport } from '../api/client';
import {
  ApiHttpError,
  ApiProtocolError,
  isRecord,
  isUuid,
  parseErrorEnvelope,
} from '../api/errors';
import type { CredentialStore, SessionAuthority } from './authority';

export type Session = components['schemas']['Session'];
export type Me = components['schemas']['Me'];

type CacheClear = () => void | Promise<void>;

export interface ApiSessionOptions {
  baseUrl: string;
  credentials: CredentialStore;
  authority: SessionAuthority;
  fetcher?: FetchFunction;
  onAuthenticatedCacheClear?: CacheClear;
  createIdempotencyKey?: () => string;
  allowDevelopmentLoopback?: boolean;
}

export interface ApiSession extends SessionTransport {
  bootstrap(signal?: AbortSignal): Promise<Me>;
  me(signal?: AbortSignal): Promise<Me>;
  acceptSession(session: Session): Promise<Me>;
  logout(signal?: AbortSignal): Promise<void>;
  clearLocalSession(): Promise<void>;
}

export function createApiSession(options: ApiSessionOptions): ApiSession {
  const baseUrl = validateBaseUrl(options.baseUrl, options.allowDevelopmentLoopback === true);
  const fetcher = options.fetcher ?? (fetch as FetchFunction);
  const createKey = options.createIdempotencyKey ?? (() => crypto.randomUUID());
  let cached: Me | null = null;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetcher(new URL(path.slice(1), baseUrl), {
      ...init,
      redirect: 'error',
      headers: new Headers(init.headers),
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ApiProtocolError('API returned a malformed response', response.status);
    }
    if (!response.ok) {
      const error = parseErrorEnvelope(payload);
      if (!error)
        throw new ApiProtocolError(
          `API returned HTTP ${response.status} with an invalid error`,
          response.status,
        );
      throw new ApiHttpError(
        response.status,
        error.error,
        error.requestId,
        response.headers.get('Retry-After'),
      );
    }
    if (!isRecord(payload) || !isUuid(payload.requestId) || !('data' in payload)) {
      throw new ApiProtocolError('API response did not match the JSON envelope', response.status);
    }
    return payload.data as T;
  }

  async function readMe(signal?: AbortSignal): Promise<Me> {
    const accessToken = await options.authority.getAccessToken();
    if (accessToken === null) throw new Error('No authenticated session');
    return request<Me>('/v1/me', {
      method: 'GET',
      signal,
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
  }

  async function clearLocalSession(): Promise<void> {
    cached = null;
    await options.authority.logout();
    await options.onAuthenticatedCacheClear?.();
  }

  function clearLocalSessionIfCurrent(revision: number): Promise<void> {
    if (options.authority.getSessionRevision() !== revision) return Promise.resolve();
    return clearLocalSession();
  }

  return {
    getSessionRevision: () => options.authority.getSessionRevision(),
    getAccessToken: () => options.authority.getAccessToken(),
    refreshAfterUnauthorized: (accessToken, signal, sessionRevision) =>
      options.authority.refreshAfterUnauthorized(accessToken, signal, sessionRevision),
    async bootstrap(signal) {
      if (signal?.aborted) throw abortError();
      const bootstrapRevision = options.authority.getSessionRevision();
      const accessToken = await options.authority.getAccessToken();
      if (signal?.aborted) throw abortError();
      if (options.authority.getSessionRevision() !== bootstrapRevision) {
        throw new Error('Session changed during bootstrap');
      }
      if (accessToken === null) throw new Error('No authenticated session');
      if (options.authority.getSessionRevision() !== bootstrapRevision) {
        throw new Error('Session changed during bootstrap');
      }
      let profile: Me;
      try {
        profile = await readMe(signal);
      } catch (error) {
        if (
          error instanceof ApiHttpError &&
          error.status === 401 &&
          options.authority.getSessionRevision() === bootstrapRevision
        ) {
          await clearLocalSessionIfCurrent(bootstrapRevision);
        }
        throw error;
      }
      if (options.authority.getSessionRevision() !== bootstrapRevision) {
        throw new Error('Session changed during bootstrap');
      }
      cached = profile;
      return profile;
    },
    async me(signal) {
      if (signal?.aborted) throw abortError();
      const before = options.authority.getSessionRevision();
      const profile = await readMe(signal);
      if (options.authority.getSessionRevision() !== before) {
        throw new Error('Session changed during profile load');
      }
      cached = profile;
      return profile;
    },
    async acceptSession(session) {
      if (!isSession(session)) throw new ApiProtocolError('Invalid session response');
      const before = options.authority.getSessionRevision();
      const previous = await options.credentials.load();
      if (options.authority.getSessionRevision() !== before) {
        throw new Error('Session changed while accepting credentials');
      }
      await options.authority.replaceSession(session);
      if (previous && previous.userId !== session.userId) {
        cached = null;
        await options.onAuthenticatedCacheClear?.();
      }
      const acceptedRevision = options.authority.getSessionRevision();
      const profile = await readMe();
      if (options.authority.getSessionRevision() !== acceptedRevision) {
        throw new Error('Session changed during profile load');
      }
      cached = profile;
      return profile;
    },
    async logout(signal) {
      const before = options.authority.getSessionRevision();
      const session = await options.credentials.load();
      if (options.authority.getSessionRevision() !== before) return;
      await options.authority.logout();
      cached = null;
      await options.onAuthenticatedCacheClear?.();
      if (!session) return;
      await request('/v1/auth/logout', {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/json',
          'Idempotency-Key': createKey(),
        },
      });
    },
    clearLocalSession,
  };
}

function isSession(value: unknown): value is Session {
  return (
    isRecord(value) &&
    typeof value.accessToken === 'string' &&
    typeof value.refreshToken === 'string' &&
    typeof value.expiresAt === 'string' &&
    Number.isFinite(Date.parse(value.expiresAt)) &&
    isUuid(value.userId)
  );
}

function validateBaseUrl(value: string, loopbackAllowed: boolean): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('API base URL must be absolute');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback && loopbackAllowed))
    throw new TypeError('API base URL must use HTTPS');
  if (url.username || url.password || url.search || url.hash)
    throw new TypeError('Invalid API base URL');
  return new URL(url.toString().endsWith('/') ? url.toString() : `${url}/`);
}

function abortError(): Error {
  return new DOMException('The operation was aborted', 'AbortError');
}
