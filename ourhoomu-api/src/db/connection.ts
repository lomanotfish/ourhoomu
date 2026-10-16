import { Pool, type PoolClient } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { and, eq, gt } from 'drizzle-orm';
import * as schema from './schema';
import type {
  Commands,
  CommandResult,
  RequestEvidence,
  UUID,
  ChoreRule,
  MemberProfile,
  BillRecord,
  AccountSelectorItem,
  EncryptedDestination,
  DashboardTotals,
  ChoreRecord,
  PaymentRecord,
  SchedulePreview,
  HouseProjection,
  AccountProjection,
  AccountSecret,
  InvitationProjection,
  ListOptions,
  MemberSnapshot,
  ChallengeInput,
  ChallengeResult,
  ExchangeReplayInput,
  ExchangeReplayResult,
  VerifiedExchangeInput,
  ExchangeResult,
} from './types';

const verified = Symbol('server-verified-principal');
export type VerifiedPrincipal = Readonly<{
  userId: UUID;
  sessionId: UUID;
  issuer: string;
  subject: string;
  authTime: string;
  expiresAt: string;
  [verified]: true;
}>;
export class DataError extends Error {
  constructor(
    readonly code: string,
    readonly currentVersion?: number,
    readonly constraint?: string,
  ) {
    super(code);
  }
}
function domainError(error: unknown): never {
  if (error && typeof error === 'object' && 'code' in error) {
    const e = error as { code: string; message?: string; detail?: string; constraint?: string };
    if (e.code === 'P0001')
      throw new DataError(
        e.message ?? 'internal_error',
        e.message === 'version_conflict' ? Number(e.detail) : undefined,
      );
    if (['23502', '23503', '23505', '23514', '22P02', '22007', '22008', '22003'].includes(e.code))
      throw new DataError('validation_error', undefined, e.constraint);
  }
  throw error;
}
/** Digest boundaries are server-side only; hashes are never accepted from HTTP bodies. */
export async function requestEvidence(
  serverHmacKey: CryptoKey,
  rawKey: string,
  exactBody: string,
): Promise<RequestEvidence> {
  if (rawKey.length < 8 || rawKey.length > 200) throw new DataError('validation_error');
  const hex = (value: ArrayBuffer) =>
    Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return {
    keyDigest: hex(
      await crypto.subtle.sign(
        'HMAC',
        serverHmacKey,
        new TextEncoder().encode(`idempotency\0${rawKey}`),
      ),
    ),
    bodyHash: hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(exactBody))),
  };
}

/** No session/role SET and no process locks. Each callback uses one real interactive transaction. */
export class CoreDatabase {
  readonly pool: Pool;
  constructor(connectionString: string) {
    const role = new URL(connectionString).username;
    if (role !== 'ourhoomu_core_app')
      throw new Error('CoreDatabase requires the restricted app role');
    this.pool = new Pool({ connectionString, max: 4 });
  }
  async withPrincipal<T>(
    principal: VerifiedPrincipal,
    work: (tx: CoreTransaction) => Promise<T>,
  ): Promise<T> {
    if (principal[verified] !== true) throw new DataError('unauthenticated');
    for (let attempt = 0; attempt < 3; attempt++) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          "select set_config('ourhoomu.user_id',$1,true),set_config('ourhoomu.session_id',$2,true)",
          [principal.userId, principal.sessionId],
        );
        const { rows } = await client.query<{ actor: string | null }>(
          'select core.actor() as actor',
        );
        if (rows[0]?.actor !== principal.userId) throw new DataError('unauthenticated');
        const result = await work(new CoreTransaction(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        if (
          attempt < 2 &&
          error &&
          typeof error === 'object' &&
          'code' in error &&
          ['40001', '40P01'].includes(String(error.code))
        )
          continue;
        return domainError(error);
      } finally {
        client.release();
      }
    }
    throw new DataError('internal_error');
  }
  async close() {
    await this.pool.end();
  }
}
export class CoreTransaction {
  private readonly db;
  constructor(private readonly client: PoolClient) {
    this.db = drizzle(client, { schema });
  }
  async command<K extends keyof Commands>(
    op: K,
    houseId: UUID | null,
    resourceId: UUID | null,
    input: Commands[K],
    evidence: RequestEvidence,
  ): Promise<CommandResult> {
    const { rows } = await this.client.query<{ result: CommandResult }>(
      'select core.command($1,$2::uuid,$3::uuid,$4::jsonb,$5,$6) as result',
      [op, houseId, resourceId, JSON.stringify(input), evidence.keyDigest, evidence.bodyHash],
    );
    const result = rows[0]?.result;
    if (!result) throw new DataError('internal_error');
    return result;
  }
  private listOptions(options: ListOptions) {
    const limit = options.limit ?? 20;
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (options.cursor !== undefined &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.cursor))
    )
      throw new DataError('validation_error');
    return { limit, cursor: options.cursor?.toLowerCase() };
  }
  async houses(options: ListOptions = {}): Promise<HouseProjection[]> {
    const { limit, cursor } = this.listOptions(options);
    return this.db
      .select({
        id: schema.houses.id,
        name: schema.houses.name,
        timezone: schema.houses.timezone,
        version: schema.houses.version,
      })
      .from(schema.houses)
      .where(cursor ? gt(schema.houses.id, cursor) : undefined)
      .orderBy(schema.houses.id)
      .limit(limit);
  }
  async me() {
    const profile = await this.projection<{ id: UUID; displayName: string }>('me');
    // /me is not paginated: include every currently accessible house.
    const houses = await this.db
      .select({
        id: schema.houses.id,
        name: schema.houses.name,
        timezone: schema.houses.timezone,
        version: schema.houses.version,
      })
      .from(schema.houses)
      .orderBy(schema.houses.id);
    return { ...profile, houses };
  }
  async house(houseId: UUID) {
    return this.projection<HouseProjection>('house', houseId);
  }
  async ownMembership(houseId: UUID) {
    return this.projection<{ id: UUID; version: number }>('ownMembership', houseId);
  }
  async targetMembership(houseId: UUID, id: UUID) {
    return this.projection<{ id: UUID; version: number }>('targetMembership', houseId, id);
  }
  async account(id: UUID) {
    return this.projection<AccountProjection>('account', null, id);
  }
  async accountSecret(id: UUID) {
    return this.projection<AccountSecret>('accountSecret', null, id);
  }
  async accounts(options: ListOptions = {}): Promise<AccountProjection[]> {
    const { limit, cursor } = this.listOptions(options);
    const rows = await this.db
      .select({
        id: schema.accounts.id,
        version: schema.accounts.version,
        bankCode: schema.accounts.bankCode,
        label: schema.accounts.label,
        maskedAccount: schema.accounts.maskedAccount,
        isDefault: schema.accounts.isDefault,
        state: schema.accounts.state,
      })
      .from(schema.accounts)
      .where(cursor ? gt(schema.accounts.id, cursor) : undefined)
      .orderBy(schema.accounts.id)
      .limit(limit);
    return rows.map(({ state, ...row }) => ({ ...row, active: state === 'active' }));
  }
  async invitation(houseId: UUID, id: UUID) {
    return this.projection<InvitationProjection>('invitation', houseId, id);
  }
  async members(houseId: UUID, options: ListOptions = {}): Promise<MemberSnapshot[]> {
    const { limit, cursor } = this.listOptions(options);
    const rows = await this.readJson<MemberProfile[]>(
      'select core.member_profiles($1::uuid) data',
      [houseId],
    );
    return rows
      .filter((row) => !cursor || row.id > cursor)
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, limit)
      .map(({ houseId: _houseId, ...row }) => row);
  }
  private projection<T>(kind: string, houseId: UUID | null = null, id: UUID | null = null) {
    return this.readJson<T>('select core.http_projection($1,$2::uuid,$3::uuid) data', [
      kind,
      houseId,
      id,
    ]);
  }
  async bill(houseId: UUID, billId: UUID) {
    return this.readJson<BillRecord>('select core.bill_detail($1::uuid,$2::uuid) as data', [
      houseId,
      billId,
    ]);
  }
  async accountSelector(houseId: UUID, billId: UUID) {
    return this.readJson<AccountSelectorItem[]>(
      'select core.account_selector($1::uuid,$2::uuid) as data',
      [houseId, billId],
    );
  }
  async privateDestination(houseId: UUID, billId: UUID) {
    return this.readJson<EncryptedDestination | null>(
      'select core.private_destination($1::uuid,$2::uuid) as data',
      [houseId, billId],
    );
  }
  async dashboard(houseId: UUID) {
    return this.readJson<DashboardTotals>('select core.dashboard($1::uuid) as data', [houseId]);
  }
  async chore(houseId: UUID, id: UUID) {
    return this.readJson<ChoreRecord>("select core.resource('chore',$1::uuid,$2::uuid) as data", [
      houseId,
      id,
    ]);
  }
  async resolvePaymentHouse(attemptId: UUID) {
    return this.readJson<UUID>('select core.resolve_payment_house($1::uuid) as data', [attemptId]);
  }
  async paymentById(attemptId: UUID) {
    return this.payment(await this.resolvePaymentHouse(attemptId), attemptId);
  }
  async payment(houseId: UUID, id: UUID) {
    return this.readJson<PaymentRecord>(
      "select core.resource('payment',$1::uuid,$2::uuid) as data",
      [houseId, id],
    );
  }
  async occurrences(houseId: UUID) {
    await this.ensureMember(houseId);
    return this.db
      .select()
      .from(schema.occurrences)
      .where(eq(schema.occurrences.houseId, houseId))
      .orderBy(schema.occurrences.localDate, schema.occurrences.id)
      .limit(100);
  }
  async payments(houseId: UUID, billId: UUID) {
    await this.bill(houseId, billId);
    return this.db
      .select()
      .from(schema.attempts)
      .where(and(eq(schema.attempts.houseId, houseId), eq(schema.attempts.billId, billId)))
      .orderBy(schema.attempts.createdAt, schema.attempts.id)
      .limit(100);
  }
  async previewSchedule(houseId: UUID, rule: ChoreRule) {
    return this.readJson<SchedulePreview>(
      'select core.preview_schedule($1::uuid,$2::jsonb) as data',
      [houseId, JSON.stringify(rule)],
    );
  }
  private async ensureMember(houseId: UUID) {
    await this.client.query('select core.reader($1::uuid)', [houseId]);
  }
  private async readJson<T>(sql: string, args: unknown[]): Promise<T> {
    const result = (await this.client.query<{ data: T }>(sql, args)).rows[0];
    if (!result) throw new DataError('internal_error');
    return result.data;
  }
}
/** Separate backend verifier credential, unavailable to app runtime SQL. No client calls this class. */
export class SessionStore {
  readonly pool: Pool;
  constructor(connectionString: string) {
    if (new URL(connectionString).username !== 'ourhoomu_core_auth')
      throw new Error('SessionStore requires restricted verifier role');
    this.pool = new Pool({ connectionString, max: 4 });
  }
  execute(op: 'challenge', input: ChallengeInput): Promise<ChallengeResult>;
  execute(op: 'exchange', input: ExchangeReplayInput): Promise<ExchangeReplayResult>;
  execute(op: 'exchange', input: VerifiedExchangeInput): Promise<ExchangeResult>;
  execute(
    op: 'rotate' | 'revoke',
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  async execute(
    op: 'challenge' | 'exchange' | 'rotate' | 'revoke',
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const result = (
        await this.pool.query<{ result: Record<string, unknown> }>(
          'select core.auth_command($1,$2::jsonb) as result',
          [op, JSON.stringify(input)],
        )
      ).rows[0]?.result;
      if (!result) throw new DataError('internal_error');
      if (result.error) throw new DataError('unauthenticated');
      return result;
    } catch (error) {
      return domainError(error);
    }
  }
  async verifyAccessDigest(accessDigest: string): Promise<VerifiedPrincipal> {
    try {
      const result = (
        await this.pool.query<{ result: Omit<VerifiedPrincipal, typeof verified> }>(
          'select core.auth_command($1,$2::jsonb) as result',
          ['verify', JSON.stringify({ accessDigest })],
        )
      ).rows[0]?.result;
      if (!result) throw new DataError('unauthenticated');
      return { ...result, [verified]: true };
    } catch (error) {
      return domainError(error);
    }
  }
  async close() {
    await this.pool.end();
  }
}
