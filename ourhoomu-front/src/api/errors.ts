import type { components } from './dto';

export type ApiErrorBody = components['schemas']['Error'];
export type ApiErrorCode = ApiErrorBody['code'];

export class ApiHttpError extends Error {
  readonly name = 'ApiHttpError';

  constructor(
    readonly status: number,
    readonly error: ApiErrorBody,
    readonly requestId: string | undefined,
    readonly retryAfter: string | null,
  ) {
    super(error.message);
  }

  get code(): ApiErrorCode {
    return this.error.code;
  }

  get currentVersion(): number | undefined {
    return this.error.code === 'version_conflict' ? this.error.currentVersion : undefined;
  }

  get retryAfterSeconds(): number | undefined {
    if (this.status !== 429 || this.retryAfter === null) return undefined;
    const seconds = Number(this.retryAfter);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
  }
}

export class ApiProtocolError extends Error {
  readonly name = 'ApiProtocolError';

  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export class OfflineMutationError extends Error {
  readonly name = 'OfflineMutationError';

  constructor(readonly method: string) {
    super(`Cannot send ${method} while offline`);
  }
}

export class SessionUnavailableError extends Error {
  readonly name = 'SessionUnavailableError';

  constructor() {
    super('An authenticated session is required');
  }
}

export function isApiHttpError(error: unknown): error is ApiHttpError {
  return error instanceof ApiHttpError;
}

export function parseErrorEnvelope(value: unknown): {
  error: ApiErrorBody;
  requestId: string;
} | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['error', 'requestId']) ||
    !isUuid(value.requestId) ||
    !isRecord(value.error) ||
    typeof value.error.code !== 'string'
  )
    return null;
  if (!hasOnlyKeys(value.error, ['code', 'message', 'fields', 'currentVersion'])) return null;
  if (typeof value.error.message !== 'string') return null;

  const code = value.error.code;
  const knownCodes: ApiErrorCode[] = [
    'validation_error',
    'unauthenticated',
    'forbidden',
    'not_found',
    'expired',
    'version_conflict',
    'idempotency_conflict',
    'recipient_account_unavailable',
    'insufficient_share',
    'rate_limited',
    'feature_unavailable',
    'internal_error',
    'invite_unavailable',
    'recent_auth_required',
    'account_deletion_blocked',
  ];
  if (!knownCodes.includes(code as ApiErrorCode)) return null;
  if (value.error.fields !== undefined && !isStringRecord(value.error.fields)) return null;
  if (code === 'version_conflict') {
    if (
      !Number.isInteger(value.error.currentVersion) ||
      (value.error.currentVersion as number) < 1
    ) {
      return null;
    }
  } else if ('currentVersion' in value.error) {
    return null;
  }

  return {
    error: value.error as ApiErrorBody,
    requestId: value.requestId,
  };
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}
