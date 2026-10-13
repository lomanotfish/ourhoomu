import type { components } from '../api/dto';
import { ApiHttpError, ApiProtocolError, isRecord, parseErrorEnvelope } from '../api/errors';
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
  allowDevelopmentLoopback?: boolean;
}

export interface SessionAuthority {
  getAccessToken(): Promise<string | null>;
  refreshAfterUnauthorized(accessToken: string, signal?: AbortSignal): Promise<string | null>;
  replaceSession(session: Session): Promise<void>;
  logout(): Promise<void>;
}

interface Flight {
  generation: number;
  promise: Promise<string | null>;
}

export function createSessionAuthority(options: SessionAuthorityOptions): SessionAuthority {
  const baseUrl = validateBaseUrl(options.baseUrl, options.allowDevelopmentLoopback === true);
  const fetcher = options.fetcher ?? (fetch as FetchFunction);
  const createKey = options.createIdempotencyKey ?? (() => crypto.randomUUID());
  let generation = 0;
  let flight: Flight | null = null;
  let credentialWrite = Promise.resolve();

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
    await serializeCredentialWrite(() => options.credentials.clear());
    await options.onAuthenticatedCacheClear?.();
  };

  const refresh = async (snapshot: Session, expectedGeneration: number): Promise<string | null> => {
    const idempotencyKey = createKey();
    const body = JSON.stringify({ refreshToken: snapshot.refreshToken });
    const url = new URL('v1/auth/refresh', baseUrl);
    const init: RequestInit = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body,
    };

    let response: Response;
    try {
      response = await fetcher(url, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      response = await retryRefreshFetch(fetcher, url, init);
    }
    if (response.status === 502 || response.status === 504) {
      response = await retryRefreshFetch(fetcher, url, init);
    }

    if (response.status === 401) {
      await clearIfCurrent(snapshot, expectedGeneration);
      return null;
    }
    if (!response.ok) throw await parseRefreshError(response);
    const session = await parseRefreshSession(response);

    const saved = await serializeCredentialWrite(async () => {
      if (generation !== expectedGeneration) return false;
      const current = await options.credentials.load();
      if (generation !== expectedGeneration || current?.refreshToken !== snapshot.refreshToken)
        return false;
      await options.credentials.save(session);
      return generation === expectedGeneration;
    });
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
      await options.credentials.clear();
      return true;
    });
    if (cleared) await options.onAuthenticatedCacheClear?.();
  };

  return {
    async getAccessToken() {
      return (await options.credentials.load())?.accessToken ?? null;
    },

    async refreshAfterUnauthorized(observedAccessToken, signal) {
      if (signal?.aborted) throw abortError();
      const current = await options.credentials.load();
      if (current === null) return null;
      if (current.accessToken !== observedAccessToken) return current.accessToken;

      const expectedGeneration = generation;
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
      const previous = await options.credentials.load();
      generation += 1;
      const replacementGeneration = generation;
      flight = null;
      await serializeCredentialWrite(async () => {
        if (generation === replacementGeneration) await options.credentials.save(session);
      });
      if (
        generation === replacementGeneration &&
        previous !== null &&
        previous.userId !== session.userId
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
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new ApiProtocolError(
      'Refresh response did not contain a session envelope',
      response.status,
    );
  }
  const data = payload.data;
  if (
    typeof data.accessToken !== 'string' ||
    typeof data.refreshToken !== 'string' ||
    typeof data.expiresAt !== 'string' ||
    typeof data.userId !== 'string'
  ) {
    throw new ApiProtocolError('Refresh response did not contain a valid session', response.status);
  }
  return data as Session;
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
