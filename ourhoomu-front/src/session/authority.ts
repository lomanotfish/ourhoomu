import type { components } from '../api/dto';
import {
  ApiHttpError,
  ApiProtocolError,
  isRecord,
  isUuid,
  parseErrorEnvelope,
} from '../api/errors';
import type { FetchFunction } from '../api/client';

export type Session = components['schemas']['Session'];

export interface CredentialStore {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
}

export interface SessionAuthorityOptions {
  baseUrl: string;
  credentials: CredentialStore;
  fetcher?: FetchFunction;
  onAuthenticatedCacheClear?: () => void | Promise<void>;
  createIdempotencyKey?: () => string;
  now?: () => number;
  allowDevelopmentLoopback?: boolean;
}

export interface SessionAuthority {
  getSessionRevision(): number;
  getAccessToken(): Promise<string | null>;
  refreshAfterUnauthorized(
    accessToken: string,
    signal?: AbortSignal,
    sessionRevision?: number,
  ): Promise<string | null>;
  replaceSession(session: Session): Promise<void>;
  logout(): Promise<void>;
}

interface Flight {
  generation: number;
  promise: Promise<string | null>;
}

interface RefreshAttempt {
  refreshToken: string;
  idempotencyKey: string;
  body: string;
  startedAt: number;
}

const refreshReplayWindowMs = 5 * 60 * 1000;

export function createSessionAuthority(options: SessionAuthorityOptions): SessionAuthority {
  const baseUrl = validateBaseUrl(options.baseUrl, options.allowDevelopmentLoopback === true);
  const fetcher = options.fetcher ?? (fetch as FetchFunction);
  const createKey = options.createIdempotencyKey ?? (() => crypto.randomUUID());
  const now = options.now ?? Date.now;
  let generation = 0;
  let flight: Flight | null = null;
  let credentialWrite = Promise.resolve();
  let knownSession: Session | null = null;
  let hasKnownSession = false;
  let uncertainAttempt: RefreshAttempt | null = null;

  const serializeCredentialWrite = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = credentialWrite.then(operation, operation);
    credentialWrite = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const clearAuthenticatedState = async () => {
    generation += 1;
    flight = null;
    knownSession = null;
    hasKnownSession = true;
    uncertainAttempt = null;
    await serializeCredentialWrite(() => options.credentials.clear());
    await options.onAuthenticatedCacheClear?.();
  };

  const refresh = async (snapshot: Session, expectedGeneration: number): Promise<string | null> => {
    let attempt = uncertainAttempt;
    if (attempt !== null && attempt.refreshToken !== snapshot.refreshToken) {
      uncertainAttempt = null;
      attempt = null;
    }
    if (attempt !== null && now() - attempt.startedAt > refreshReplayWindowMs) {
      uncertainAttempt = null;
      await clearIfCurrent(snapshot, expectedGeneration);
      return null;
    }
    if (attempt === null) {
      attempt = {
        refreshToken: snapshot.refreshToken,
        idempotencyKey: createKey(),
        body: JSON.stringify({ refreshToken: snapshot.refreshToken }),
        startedAt: now(),
      };
    }
    const url = new URL('v1/auth/refresh', baseUrl);
    const init: RequestInit = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': attempt.idempotencyKey,
      },
      body: attempt.body,
      redirect: 'error',
    };

    let response: Response;
    let uncertain = false;
    try {
      response = await fetcher(url, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      try {
        response = await retryRefreshFetch(fetcher, url, init);
      } catch (retryError) {
        uncertain = true;
        if (generation === expectedGeneration) uncertainAttempt = attempt;
        throw retryError;
      }
    }
    if (response.status === 502 || response.status === 504) {
      uncertain = true;
      try {
        response = await retryRefreshFetch(fetcher, url, init);
      } catch (retryError) {
        uncertain = true;
        if (generation === expectedGeneration) uncertainAttempt = attempt;
        throw retryError;
      }
      if (response.status === 502 || response.status === 504) uncertain = true;
    }

    if (response.status === 401) {
      uncertainAttempt = null;
      await clearIfCurrent(snapshot, expectedGeneration);
      return null;
    }
    if (!response.ok) {
      if ((uncertain || response.status >= 500) && generation === expectedGeneration)
        uncertainAttempt = attempt;
      throw await parseRefreshError(response);
    }
    if (generation === expectedGeneration) uncertainAttempt = attempt;
    const session = await parseRefreshSession(response);

    const saved = await serializeCredentialWrite(async () => {
      if (generation !== expectedGeneration) return false;
      const current = await options.credentials.load();
      if (generation !== expectedGeneration || current?.refreshToken !== snapshot.refreshToken)
        return false;
      await options.credentials.save(session);
      knownSession = session;
      hasKnownSession = true;
      return generation === expectedGeneration;
    });
    if (saved && uncertainAttempt === attempt) uncertainAttempt = null;
    return saved ? session.accessToken : null;
  };

  const clearIfCurrent = async (snapshot: Session, expectedGeneration: number) => {
    const cleared = await serializeCredentialWrite(async () => {
      if (generation !== expectedGeneration) return false;
      const current = await options.credentials.load();
      if (generation !== expectedGeneration || current?.refreshToken !== snapshot.refreshToken)
        return false;
      generation += 1;
      flight = null;
      knownSession = null;
      hasKnownSession = true;
      uncertainAttempt = null;
      await options.credentials.clear();
      return true;
    });
    if (cleared) await options.onAuthenticatedCacheClear?.();
  };

  return {
    getSessionRevision() {
      return generation;
    },

    async getAccessToken() {
      const expectedGeneration = generation;
      const current = await serializeCredentialWrite(async () => {
        if (generation !== expectedGeneration) return null;
        const stored = await options.credentials.load();
        if (generation !== expectedGeneration) return null;
        if (hasKnownSession) {
          if (knownSession === null) return null;
          if (
            stored === null ||
            stored.accessToken !== knownSession.accessToken ||
            stored.refreshToken !== knownSession.refreshToken
          ) {
            return knownSession;
          }
        }
        knownSession = stored;
        hasKnownSession = true;
        return stored;
      });
      return generation === expectedGeneration ? (current?.accessToken ?? null) : null;
    },

    async refreshAfterUnauthorized(observedAccessToken, signal, sessionRevision) {
      if (signal?.aborted) throw abortError();
      const expectedGeneration = sessionRevision ?? generation;
      if (generation !== expectedGeneration) return null;
      const current = await serializeCredentialWrite(async () => {
        if (generation !== expectedGeneration) return null;
        const stored = await options.credentials.load();
        if (generation !== expectedGeneration) return null;
        if (hasKnownSession) {
          if (knownSession === null) return null;
          if (
            stored === null ||
            stored.accessToken !== knownSession.accessToken ||
            stored.refreshToken !== knownSession.refreshToken
          ) {
            return knownSession;
          }
        }
        knownSession = stored;
        hasKnownSession = true;
        return stored;
      });
      if (generation !== expectedGeneration) return null;
      if (current === null) return null;
      if (current.accessToken !== observedAccessToken) return current.accessToken;

      let activeFlight = flight;
      if (activeFlight?.generation !== expectedGeneration) activeFlight = null;
      if (activeFlight === null) {
        const promise = refresh(current, expectedGeneration);
        activeFlight = { generation: expectedGeneration, promise };
        flight = activeFlight;
        void promise
          .finally(() => {
            if (flight === activeFlight) flight = null;
          })
          .catch(() => undefined);
      }
      return waitForCaller(activeFlight.promise, signal);
    },

    async replaceSession(session) {
      generation += 1;
      const replacementGeneration = generation;
      flight = null;
      const previous = knownSession;
      const hadPrevious = hasKnownSession;
      knownSession = session;
      hasKnownSession = true;
      uncertainAttempt = null;
      const storedPrevious = await serializeCredentialWrite(async () => {
        if (generation !== replacementGeneration) return null;
        const beforeReplacement = hadPrevious ? previous : await options.credentials.load();
        if (generation !== replacementGeneration) return null;
        await options.credentials.save(session);
        return beforeReplacement;
      });
      if (
        generation === replacementGeneration &&
        storedPrevious !== null &&
        storedPrevious !== undefined &&
        storedPrevious.userId !== session.userId
      ) {
        await options.onAuthenticatedCacheClear?.();
      }
    },

    async logout() {
      await clearAuthenticatedState();
    },
  };
}

async function retryRefreshFetch(
  fetcher: FetchFunction,
  url: URL,
  init: RequestInit,
): Promise<Response> {
  return fetcher(url, { ...init, headers: new Headers(init.headers), body: init.body });
}

async function parseRefreshSession(response: Response): Promise<Session> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiProtocolError('Refresh response was not valid JSON', response.status);
  }
  if (
    !isRecord(payload) ||
    Object.keys(payload).some((key) => !['data', 'requestId'].includes(key)) ||
    !isUuid(payload.requestId) ||
    !isRecord(payload.data)
  ) {
    throw new ApiProtocolError(
      'Refresh response did not contain a session envelope',
      response.status,
    );
  }
  const data = payload.data;
  if (
    Object.keys(data).some(
      (key) => !['accessToken', 'refreshToken', 'expiresAt', 'userId'].includes(key),
    ) ||
    typeof data.accessToken !== 'string' ||
    typeof data.refreshToken !== 'string' ||
    typeof data.expiresAt !== 'string' ||
    !isUuid(data.userId) ||
    !isDateTime(data.expiresAt)
  ) {
    throw new ApiProtocolError('Refresh response did not contain a valid session', response.status);
  }
  return data as Session;
}

function isDateTime(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

async function parseRefreshError(response: Response): Promise<ApiHttpError | ApiProtocolError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return new ApiProtocolError(
      `Refresh returned HTTP ${response.status} without a valid error`,
      response.status,
    );
  }
  const envelope = parseErrorEnvelope(payload);
  if (envelope === null) {
    return new ApiProtocolError(
      `Refresh returned HTTP ${response.status} with an invalid error`,
      response.status,
    );
  }
  return new ApiHttpError(
    response.status,
    envelope.error,
    envelope.requestId,
    response.headers.get('Retry-After'),
  );
}

function validateBaseUrl(value: string, allowDevelopmentLoopback: boolean): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('API base URL must be an absolute URL');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && loopback && allowDevelopmentLoopback)
  ) {
    throw new TypeError(
      'API base URL must use HTTPS (HTTP is allowed only for opted-in loopback development)',
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError('API base URL cannot contain credentials, query, or fragment');
  }
  return new URL(url.toString().endsWith('/') ? url.toString() : `${url.toString()}/`);
}

function waitForCaller<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function abortError(): Error {
  return new DOMException('The operation was aborted', 'AbortError');
}
