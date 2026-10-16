import { DataError } from '../../db/connection';
import { IssuerVerificationError } from '../auth/issuer';
import { coreDataHttp, type CoreData } from './data';
import { fields, text, uuid } from './validation';
import type { Sessions } from '../auth/session';

export type CoreServices = { sessions: Sessions; data?: CoreData };
const statuses: Record<string, number> = {
  validation_error: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  version_conflict: 409,
  idempotency_conflict: 409,
  conflict: 409,
  recipient_account_unavailable: 409,
  insufficient_share: 409,
  invite_unavailable: 409,
  recent_auth_required: 403,
  account_deletion_blocked: 409,
  expired: 410,
  rate_limited: 429,
  feature_unavailable: 503,
};
function proof(value: unknown) {
  const result = text(value, 128, 32);
  if (!/^[A-Za-z0-9_-]+$/.test(result)) throw new DataError('validation_error');
  return result;
}
function provider(value: unknown) {
  if (value !== 'google' && value !== 'apple') throw new DataError('validation_error');
  return value;
}
async function boundedBody(request: Request) {
  const limit = 16384;
  const declared = request.headers.get('content-length');
  if (declared && (!/^[0-9]+$/.test(declared) || Number(declared) > limit))
    throw new DataError('validation_error');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new DataError('validation_error');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (
    length &&
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    throw new DataError('validation_error');
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    // Preserve BOM rather than silently changing the body used for evidence.
    // JSON.parse rejects it; fatal decoding rejects noncanonical UTF-8 bytes.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new DataError('validation_error');
  }
}

export async function coreHttp(request: Request, requestId: string, services?: CoreServices) {
  const headers = {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-request-id': requestId,
  };
  const respond = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers });
  try {
    const path = new URL(request.url).pathname;
    const publicAuth = ['/v1/auth/challenges', '/v1/auth/exchange', '/v1/auth/refresh'].includes(
      path,
    );
    if (!publicAuth && !request.headers.get('authorization'))
      throw new DataError('unauthenticated');
    if (!services) throw new DataError('feature_unavailable');
    const exactBody = await boundedBody(request);
    let body: unknown;
    try {
      body = exactBody ? JSON.parse(exactBody) : undefined;
    } catch {
      throw new DataError('validation_error');
    }
    const mutationKey =
      request.method !== 'GET' ? uuid(request.headers.get('idempotency-key')) : '';
    let data: unknown;
    if (request.method === 'POST' && path === '/v1/auth/challenges') {
      const input = fields(body, ['provider', 'clientNonce']);
      data = await services.sessions.challenge(
        provider(input.provider),
        proof(input.clientNonce),
        mutationKey,
        exactBody,
      );
    } else if (request.method === 'POST' && path === '/v1/auth/exchange') {
      const input = fields(body, ['provider', 'challengeId', 'proof', 'idToken']);
      data = await services.sessions.exchange(
        provider(input.provider),
        uuid(input.challengeId),
        proof(input.proof),
        text(input.idToken, 12000),
        mutationKey,
        exactBody,
      );
    } else if (request.method === 'POST' && path === '/v1/auth/refresh') {
      const input = fields(body, ['refreshToken']);
      data = await services.sessions.refresh(
        text(input.refreshToken, 128, 32),
        mutationKey,
        exactBody,
      );
    } else {
      const actor = await services.sessions.authenticate(request.headers.get('authorization'));
      if (!services.data) throw new DataError('feature_unavailable');
      return respond({
        ...(await coreDataHttp(
          services.data,
          services.sessions.secrets,
          actor,
          request,
          body,
          exactBody,
        )),
        requestId,
      });
    }
    return respond({ data, requestId });
  } catch (error) {
    const code =
      error instanceof IssuerVerificationError
        ? 'unauthenticated'
        : error instanceof DataError
          ? error.code
          : 'internal_error';
    const status = statuses[code] ?? 500;
    const publicCode = status === 500 ? 'internal_error' : code;
    return respond(
      {
        error: {
          code: publicCode,
          message: publicCode.replaceAll('_', ' '),
          ...(error instanceof DataError &&
          code === 'version_conflict' &&
          error.currentVersion !== undefined
            ? { currentVersion: error.currentVersion }
            : {}),
        },
        requestId,
      },
      status,
    );
  }
}
