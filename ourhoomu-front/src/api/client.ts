import {
  ApiHttpError,
  ApiProtocolError,
  OfflineMutationError,
  SessionUnavailableError,
  isRecord,
  parseErrorEnvelope,
} from './errors';

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface SessionTransport {
  getAccessToken(): Promise<string | null>;
  refreshAfterUnauthorized(accessToken: string, signal?: AbortSignal): Promise<string | null>;
}

export interface ApiRequestOptions {
  method?: string;
  body?: JsonValue;
  idempotencyKey?: string;
  signal?: AbortSignal;
  authenticated?: boolean;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetcher?: FetchFunction;
  isOnline?: () => boolean | Promise<boolean>;
  session: SessionTransport;
  allowDevelopmentLoopback?: boolean;
}

interface SuccessEnvelope<T> {
  data: T;
  requestId: string;
}

export interface ApiClient {
  request<TData>(path: string, options?: ApiRequestOptions): Promise<TData>;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = validateBaseUrl(options.baseUrl, options.allowDevelopmentLoopback === true);
  const fetcher = options.fetcher ?? (fetch as FetchFunction);
  const isOnline = options.isOnline ?? (() => true);

  return {
    async request<TData>(path: string, requestOptions: ApiRequestOptions = {}): Promise<TData> {
      const method = (requestOptions.method ?? 'GET').toUpperCase();
      const authenticated = requestOptions.authenticated !== false;
      const url = resolvePath(baseUrl, path);
      if (requestOptions.body !== undefined) assertNoClientActor(requestOptions.body);
      const body =
        requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body);
      const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);

      if (mutation && !(await isOnline())) throw new OfflineMutationError(method);
      if (requestOptions.signal?.aborted) throw abortError();

      const headers = new Headers({ Accept: 'application/json' });
      if (body !== undefined) headers.set('Content-Type', 'application/json');
      if (requestOptions.idempotencyKey !== undefined) {
        headers.set('Idempotency-Key', requestOptions.idempotencyKey);
      }

      let accessToken: string | null = null;
      if (authenticated) {
        accessToken = await options.session.getAccessToken();
        if (requestOptions.signal?.aborted) throw abortError();
        if (accessToken === null) throw new SessionUnavailableError();
        headers.set('Authorization', `Bearer ${accessToken}`);
      }

      const init: RequestInit = {
        method,
        headers,
        body,
        signal: requestOptions.signal,
      };
      let response = await fetcher(url, init);

      if (
        response.status === 401 &&
        authenticated &&
        accessToken !== null &&
        (!mutation || requestOptions.idempotencyKey !== undefined) &&
        !requestOptions.signal?.aborted
      ) {
        const refreshedToken = await options.session.refreshAfterUnauthorized(
          accessToken,
          requestOptions.signal,
        );
        if (refreshedToken !== null && !requestOptions.signal?.aborted) {
          const replayHeaders = new Headers(headers);
          replayHeaders.set('Authorization', `Bearer ${refreshedToken}`);
          response = await fetcher(url, { ...init, headers: replayHeaders });
        }
      }

      if (!response.ok) throw await toApiError(response);
      return (await toSuccess<TData>(response)).data;
    },
  };
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

function resolvePath(baseUrl: URL, path: string): URL {
  if (!path.startsWith('/') || path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path)) {
    throw new TypeError('API path must be an absolute path on the configured origin');
  }
  const url = new URL(path.slice(1), baseUrl);
  if (url.origin !== baseUrl.origin) throw new TypeError('API path cannot change origin');
  return url;
}

function assertNoClientActor(value: JsonValue): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoClientActor);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  const actorFields = new Set([
    'actor',
    'actorId',
    'actorUserId',
    'currentUserId',
    'userId',
    'user_id',
    'role',
    'houseRole',
  ]);
  for (const [key, child] of Object.entries(value)) {
    if (actorFields.has(key)) {
      throw new TypeError(`Request body cannot choose authenticated actor field "${key}"`);
    }
    assertNoClientActor(child);
  }
}

async function toSuccess<T>(response: Response): Promise<SuccessEnvelope<T>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiProtocolError('API returned a malformed success response', response.status);
  }
  if (!isRecord(payload) || !('data' in payload) || typeof payload.requestId !== 'string') {
    throw new ApiProtocolError(
      'API success response did not match the JSON envelope',
      response.status,
    );
  }
  return payload as unknown as SuccessEnvelope<T>;
}

async function toApiError(response: Response): Promise<ApiHttpError | ApiProtocolError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return new ApiProtocolError(
      `API returned HTTP ${response.status} without a valid error envelope`,
      response.status,
    );
  }
  const envelope = parseErrorEnvelope(payload);
  if (envelope === null) {
    return new ApiProtocolError(
      `API returned HTTP ${response.status} with an invalid error envelope`,
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

function abortError(): Error {
  return new DOMException('The operation was aborted', 'AbortError');
}
