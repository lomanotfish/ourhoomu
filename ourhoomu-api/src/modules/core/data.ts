import type { components } from '@ourhoomu/contracts';
import type { VerifiedPrincipal } from '../../db/connection';
import type { CommandResult, Commands, RequestEvidence } from '../../db/types';

type DTO = components['schemas'];
export interface HttpTransaction {
  command(
    op: keyof Commands,
    houseId: string | null,
    resourceId: string | null,
    input: Record<string, unknown>,
    evidence: RequestEvidence,
  ): Promise<CommandResult & { data?: DTO['Member'] }>;
  me(): Promise<DTO['Me']>;
  houses(): Promise<DTO['House'][]>;
  house(houseId: string): Promise<DTO['House']>;
  targetMembership(houseId: string, id: string): Promise<{ id: string; version: number }>;
  ownMembership(houseId: string): Promise<{ id: string; version: number }>;
  members(houseId: string): Promise<DTO['Member'][]>;
  ownAccounts(): Promise<DTO['AccountPrivate'][]>;
  ownAccount(id: string): Promise<DTO['AccountPrivate']>;
  accountSecret(id: string): Promise<{
    bankCode: string;
    identifierCiphertext: string;
    identifierDigest: string;
    keyVersion: number;
  }>;
  invitation(houseId: string, id: string): Promise<DTO['InvitationMetadata']>;
}
export interface CoreData {
  withPrincipal<T>(
    principal: VerifiedPrincipal,
    work: (tx: HttpTransaction) => Promise<T>,
  ): Promise<T>;
}

import { DataError, requestEvidence } from '../../db/connection';
import { digest, randomSecret, type ServerSecrets } from '../auth/secrets';
import { fields, integer, text, uuid } from './validation';

const houseDto = (row: DTO['House']): DTO['House'] => ({
  id: row.id,
  name: row.name,
  timezone: row.timezone,
  version: row.version,
  ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}),
});
const memberDto = (row: DTO['Member']): DTO['Member'] => ({
  id: row.id,
  displayName: row.displayName,
  role: row.role,
  active: row.active,
  version: row.version,
  ...(row.removedAt ? { removedAt: row.removedAt } : {}),
});
const accountDto = (row: DTO['AccountPrivate']): DTO['AccountPrivate'] => ({
  id: row.id,
  version: row.version,
  bankCode: row.bankCode,
  label: row.label,
  maskedAccount: row.maskedAccount,
  isDefault: row.isDefault,
  active: row.active,
});
const invitationDto = (row: DTO['InvitationMetadata']): DTO['InvitationMetadata'] => ({
  id: row.id,
  houseId: row.houseId,
  status: row.status,
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
});
const meDto = (row: DTO['Me']): DTO['Me'] => ({
  id: row.id,
  displayName: row.displayName,
  houses: row.houses.map(houseDto),
});
function timezone(value: unknown) {
  const result = text(value, 100);
  try {
    new Intl.DateTimeFormat('en', { timeZone: result });
  } catch {
    throw new DataError('validation_error');
  }
  return result;
}
function boolean(value: unknown) {
  if (typeof value !== 'boolean') throw new DataError('validation_error');
  return value;
}
async function page<T extends { id: string }>(
  rows: T[],
  url: URL,
  actor: VerifiedPrincipal,
  secrets: ServerSecrets,
) {
  const rawLimit = url.searchParams.get('limit');
  if (rawLimit !== null && !/^[1-9][0-9]*$/.test(rawLimit)) throw new DataError('validation_error');
  const limit = rawLimit === null ? 20 : integer(Number(rawLimit), 100);
  const cursor = url.searchParams.get('cursor');
  const scope = `${actor.userId}:${url.pathname}`;
  let after = '';
  if (cursor) {
    const [id, mac, extra] = cursor.split('.');
    if (
      !id ||
      !mac ||
      extra !== undefined ||
      !(await secrets.verifyMac('list-cursor', [scope, id], mac))
    )
      throw new DataError('validation_error');
    after = uuid(id);
  }
  const sorted = rows.filter((row) => row.id > after).sort((a, b) => a.id.localeCompare(b.id));
  const data = sorted.slice(0, limit);
  const last = data.at(-1);
  return {
    data,
    nextCursor:
      sorted.length > limit && last
        ? `${last.id}.${await secrets.mac('list-cursor', [scope, last.id])}`
        : null,
  };
}

export async function coreDataHttp(
  database: CoreData,
  secrets: ServerSecrets,
  actor: VerifiedPrincipal,
  request: Request,
  body: unknown,
  exactBody: string,
): Promise<{ data: unknown; nextCursor?: string | null }> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const houseMatch = /^\/v1\/houses\/([^/]+)(.*)$/.exec(path);
  const houseId = houseMatch ? uuid(houseMatch[1]) : null;
  const tail = houseMatch?.[2] ?? '';
  const evidence = async () =>
    requestEvidence(secrets.hmacKey, uuid(request.headers.get('idempotency-key')), exactBody);
  return database.withPrincipal(actor, async (tx) => {
    if (method === 'GET' && path === '/v1/me') return { data: meDto(await tx.me()) };
    if (method === 'DELETE' && path === '/v1/me') {
      const input = fields(body, ['reauthProof', 'expectedVersion']);
      text(input.reauthProof, 12000);
      integer(input.expectedVersion);
      throw new DataError('feature_unavailable');
    }
    if (method === 'POST' && path === '/v1/auth/logout') {
      if (body !== undefined) throw new DataError('validation_error');
      const before = meDto(await tx.me());
      await tx.command('session.revoke', null, null, {}, await evidence());
      return { data: before };
    }
    if (method === 'GET' && path === '/v1/houses')
      return page((await tx.houses()).map(houseDto), url, actor, secrets);
    if (method === 'POST' && path === '/v1/houses') {
      const input = fields(body, ['name', 'timezone']);
      const result = await tx.command(
        'house.create',
        null,
        null,
        { name: text(input.name), timezone: timezone(input.timezone) },
        await evidence(),
      );
      return { data: houseDto(await tx.house(result.resourceId)) };
    }
    if (houseId && tail === '') {
      if (method === 'GET') return { data: houseDto(await tx.house(houseId)) };
      if (method === 'PATCH') {
        const input = fields(body, ['name', 'timezone', 'expectedVersion']);
        await tx.command(
          'house.update',
          houseId,
          null,
          {
            name: text(input.name),
            timezone: timezone(input.timezone),
            expectedVersion: integer(input.expectedVersion),
          },
          await evidence(),
        );
        return { data: houseDto(await tx.house(houseId)) };
      }
    }
    if (houseId && method === 'GET' && tail === '/members')
      return page((await tx.members(houseId)).map(memberDto), url, actor, secrets);
    if (houseId && method === 'POST' && tail === '/invitations') {
      const input = fields(body, ['expiresInSeconds']);
      const expiresInSeconds = integer(input.expiresInSeconds, 604800);
      const proof = await evidence();
      const scope = JSON.stringify([actor.userId, houseId, proof.keyDigest, proof.bodyHash]);
      const token = randomSecret();
      const result = await tx.command(
        'invite.create',
        houseId,
        null,
        {
          tokenDigest: await digest(token),
          expiresInSeconds,
          replayCiphertext: await secrets.seal('invitation-replay', scope, { token }),
        },
        proof,
      );
      if (!result.replayCiphertext) throw new DataError('internal_error');
      const replay = await secrets.open('invitation-replay', scope, result.replayCiphertext);
      if (typeof replay.token !== 'string') throw new DataError('internal_error');
      return {
        data: {
          ...invitationDto(await tx.invitation(houseId, result.resourceId)),
          token: replay.token,
        },
      };
    }
    if (houseId && method === 'DELETE' && /^\/invitations\/[^/]+$/.test(tail)) {
      if (body !== undefined) throw new DataError('validation_error');
      const id = uuid(tail.split('/')[2]);
      await tx.command('invite.revoke', houseId, id, {}, await evidence());
      return { data: invitationDto(await tx.invitation(houseId, id)) };
    }
    if (method === 'POST' && path === '/v1/invitations/accept') {
      const input = fields(body, ['token']);
      const result = await tx.command(
        'invite.accept',
        null,
        null,
        { tokenDigest: await digest(text(input.token, 128, 32)) },
        await evidence(),
      );
      if (!result.data) throw new DataError('internal_error');
      return { data: memberDto(result.data) };
    }
    if (
      houseId &&
      ((method === 'POST' && tail === '/leave') ||
        (method === 'DELETE' && /^\/members\/[^/]+$/.test(tail)))
    ) {
      if (body !== undefined) throw new DataError('validation_error');
      const leaving = tail === '/leave';
      const target = leaving
        ? await tx.ownMembership(houseId)
        : await tx.targetMembership(houseId, uuid(tail.split('/')[2]));
      if (!target) throw new DataError('not_found');
      const result = await tx.command(
        leaving ? 'member.leave' : 'member.remove',
        houseId,
        target.id,
        { expectedVersion: target.version },
        await evidence(),
      );
      if (!result.data) throw new DataError('internal_error');
      return { data: memberDto(result.data) };
    }
    if (method === 'GET' && path === '/v1/me/recipient-accounts')
      return page((await tx.ownAccounts()).map(accountDto), url, actor, secrets);
    const accountMatch = /^\/v1\/me\/recipient-accounts\/([^/]+)$/.exec(path);
    if (
      (method === 'POST' && path === '/v1/me/recipient-accounts') ||
      (method === 'PATCH' && accountMatch)
    ) {
      const updating = !!accountMatch;
      const id = accountMatch ? uuid(accountMatch[1]) : null;
      const input = updating
        ? fields(
            body,
            ['expectedVersion'],
            ['bankCode', 'label', 'accountNumber', 'isDefault', 'active'],
          )
        : fields(body, ['bankCode', 'label', 'accountNumber'], ['isDefault']);
      const output: Record<string, unknown> = {};
      if (updating) output.expectedVersion = integer(input.expectedVersion);
      if (input.bankCode !== undefined) {
        output.bankCode = text(input.bankCode, 20);
        if (!/^[A-Z0-9_]{2,20}$/.test(String(output.bankCode)))
          throw new DataError('validation_error');
      }
      if (input.label !== undefined) output.label = text(input.label);
      if (input.isDefault !== undefined) output.isDefault = boolean(input.isDefault);
      const active = input.active === undefined ? true : boolean(input.active);
      if (!active && Object.keys(input).some((key) => !['active', 'expectedVersion'].includes(key)))
        throw new DataError('validation_error');
      if (input.accountNumber !== undefined || (updating && input.bankCode !== undefined)) {
        let accountNumber = input.accountNumber;
        if (accountNumber === undefined && id) {
          const previous = await tx.accountSecret(id);
          if (previous.keyVersion !== secrets.version) throw new DataError('feature_unavailable');
          const decrypted = await secrets.open(
            'account-identifier',
            JSON.stringify([actor.userId, previous.identifierDigest]),
            previous.identifierCiphertext,
          );
          accountNumber = decrypted.accountNumber;
        }
        const normalized = text(accountNumber, 34, 5);
        if (!/^[0-9]+$/.test(normalized)) throw new DataError('validation_error');
        if (!output.bankCode && id) output.bankCode = (await tx.ownAccount(id)).bankCode;
        const identifierDigest = await secrets.mac('account-identifier-digest', [
          String(output.bankCode),
          normalized,
        ]);
        Object.assign(output, {
          identifierKind: 'bank_account',
          identifierDigest,
          keyVersion: secrets.version,
          identifierCiphertext: await secrets.seal(
            'account-identifier',
            JSON.stringify([actor.userId, identifierDigest]),
            { accountNumber: normalized },
          ),
          maskedAccount: `••••${normalized.slice(-4)}`,
        });
      }
      const result = await tx.command(
        !active ? 'account.archive' : updating ? 'account.update' : 'account.create',
        null,
        id,
        output,
        await evidence(),
      );
      return { data: accountDto(await tx.ownAccount(result.resourceId)) };
    }
    throw new DataError('not_found');
  });
}
