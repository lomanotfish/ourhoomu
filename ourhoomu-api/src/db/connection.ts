import { Pool, type PoolClient } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, gt } from 'drizzle-orm';
import * as schema from './schema';
import type {
  Commands,
  CommandResult,
  RequestEvidence,
  UUID,
  ChoreRule,
  MemberProfile,
  BillRecord,
  BillListProjection,
  CorePage,
  ChoreListOptions,
  ChoreProjection,
  PaymentSummaryProjection,
  ActivityProjection,
  DashboardProjection,
  AccountSelectorItem,
  EncryptedDestination,
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
  private async readPage<T extends { id: UUID }>(
    sql: string,
    args: unknown[],
    limit: number,
  ): Promise<CorePage<T>> {
    const rows = await this.readJson<T[]>(sql, args);
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }
  private dateOnly(value: string | undefined): string | null {
    if (value === undefined) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DataError('validation_error');
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
      throw new DataError('validation_error');
    return value;
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
  async bills(houseId: UUID, options: ListOptions = {}): Promise<CorePage<BillListProjection>> {
    const { limit, cursor } = this.listOptions(options);
    await this.ensureMember(houseId);
    return this.readPage<BillListProjection>(
      `with viewer as (select core.member($1::uuid) id),
       cursor_row as (select created_at,id from core.bills where house_id=$1::uuid and id=$3::uuid)
       select coalesce(jsonb_agg(item order by created_at,id),'[]'::jsonb) data from (
         select b.id,b.created_at,jsonb_build_object(
           'id',b.id,'houseId',b.house_id,'creatorMembershipId',b.creator_membership_id,
           'recipientMembershipId',b.recipient_membership_id,'title',b.title,'emoji',b.emoji,
           'dueDate',b.due_date,'totalSatang',b.total_satang,'currency',b.currency,
           'status',b.status,'version',b.version,
           'recipientAccountMasked',(select s.masked_account from core.bill_recipient_snapshots s
             where s.house_id=b.house_id and s.bill_id=b.id and s.expires_at>statement_timestamp()),
           'createdAt',b.created_at,'expiresAt',b.expires_at,
           'confirmedSatang',coalesce((select sum(c.amount_satang)::numeric
             from core.payment_confirmations c join core.bill_shares sh
               on sh.house_id=c.house_id and sh.bill_id=c.bill_id and sh.membership_id=c.payer_membership_id
             where c.house_id=b.house_id and c.bill_id=b.id and not sh.self_covered
               and sh.expires_at>statement_timestamp()
               and c.expires_at>statement_timestamp()),0),
           'outstandingSatang',coalesce((select sum(greatest(sh.amount_satang::numeric-coalesce((
             select sum(c.amount_satang)::numeric from core.payment_confirmations c
             where c.house_id=sh.house_id and c.bill_id=sh.bill_id
               and c.payer_membership_id=sh.membership_id and c.expires_at>statement_timestamp()
           ),0),0)) from core.bill_shares sh where sh.house_id=b.house_id and sh.bill_id=b.id
             and sh.expires_at>statement_timestamp() and not sh.self_covered),0),
           'pendingSatang',coalesce((select sum(p.amount_satang)::numeric from core.payment_attempts p
             where p.house_id=b.house_id and p.bill_id=b.id and p.reservation_released_at is null
               and p.reservation_until>statement_timestamp() and p.expires_at>statement_timestamp()),0),
           'viewerMembershipId',(select id from viewer),
           'viewerRemainingSatang',coalesce((select greatest(sh.amount_satang::numeric-coalesce((
             select sum(c.amount_satang)::numeric from core.payment_confirmations c
             where c.house_id=sh.house_id and c.bill_id=sh.bill_id
               and c.payer_membership_id=sh.membership_id and c.expires_at>statement_timestamp()
           ),0),0) from core.bill_shares sh where sh.house_id=b.house_id and sh.bill_id=b.id
             and sh.expires_at>statement_timestamp() and sh.membership_id=(select id from viewer)
             and not sh.self_covered),0),
           'viewerPendingSatang',coalesce((select sum(p.amount_satang)::numeric from core.payment_attempts p
             where p.house_id=b.house_id and p.bill_id=b.id and p.payer_membership_id=(select id from viewer)
               and p.reservation_released_at is null and p.reservation_until>statement_timestamp()
               and p.expires_at>statement_timestamp()),0)
         ) item
         from core.bills b
         where b.house_id=$1::uuid and b.expires_at>statement_timestamp()
           and (b.status<>'draft' or b.creator_membership_id=(select id from viewer))
           and ($3::uuid is null or (b.created_at,b.id)>(select created_at,id from cursor_row))
         order by b.created_at,b.id limit $2::integer
       ) page_rows`,
      [houseId, limit + 1, cursor ?? null],
      limit,
    );
  }
  async accountSelector(houseId: UUID, billId: UUID, recipientMembershipId: UUID) {
    await this.ensureMember(houseId);
    await this.bill(houseId, billId);
    const recipient = await this.readJson<{ membershipId: UUID }>(
      `select jsonb_build_object('membershipId',recipient_membership_id) data
       from core.bills where house_id=$1::uuid and id=$2::uuid
         and expires_at>statement_timestamp()`,
      [houseId, billId],
    );
    if (recipient.membershipId !== recipientMembershipId) throw new DataError('validation_error');
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
  async dashboard(houseId: UUID): Promise<DashboardProjection> {
    return this.readJson<DashboardProjection>(
      `with asof as (select statement_timestamp() at),
      viewer as (select core.reader($1::uuid) membership_id),
      house as (select timezone from core.houses where id=$1::uuid),
      remaining as (
        select s.membership_id,b.recipient_membership_id,
          s.amount_satang::numeric-coalesce((
            select sum(c.amount_satang)::numeric from core.payment_confirmations c
            where c.house_id=s.house_id and c.bill_id=s.bill_id
              and c.payer_membership_id=s.membership_id and c.expires_at>(select at from asof)
          ),0) amount
        from core.bill_shares s join core.bills b
          on b.house_id=s.house_id and b.id=s.bill_id
        where s.house_id=$1::uuid and not s.self_covered
          and s.expires_at>(select at from asof) and b.expires_at>(select at from asof)
          and b.status in ('open','settled')
      ),
      pending as (
        select p.* from core.payment_attempts p
        join core.bills b on b.house_id=p.house_id and b.id=p.bill_id
        where p.house_id=$1::uuid and p.reservation_released_at is null
          and p.reservation_until>(select at from asof) and p.expires_at>(select at from asof)
          and b.expires_at>(select at from asof) and b.status='open'
          and (p.payer_membership_id=(select membership_id from viewer)
            or (b.creator_membership_id=(select membership_id from viewer)
              and p.method='cash' and p.status='awaiting_confirmation'))
      ),
      chore_rows as (
        select o.id,jsonb_build_object(
          'id',o.id,'houseId',o.house_id,'scheduleId',o.schedule_id,'title',o.title,
          'localDate',o.local_date,'assigneeMembershipId',o.assignee_membership_id,
          'status',o.status,'version',o.version,'expiresAt',o.expires_at,
          'assignmentState',case when o.assignee_membership_id is null then 'unassigned' else 'assigned' end,
          'completedAt',o.completed_at
        ) || case when o.emoji is null then '{}'::jsonb else jsonb_build_object('emoji',o.emoji) end
          || case when ce.actor_membership_id is null then '{}'::jsonb else jsonb_build_object('completedByMembershipId',ce.actor_membership_id) end item
        from core.chore_occurrences o
        left join lateral (
          select actor_membership_id from core.chore_completion_events e
          where e.house_id=o.house_id and e.occurrence_id=o.id and e.action='completed'
          order by e.transition_version desc limit 1
        ) ce on true
        where o.house_id=$1::uuid and o.local_date=(select (at at time zone timezone)::date from asof,house)
          and o.expires_at>(select at from asof)
      )
      select jsonb_build_object(
        'asOf',(select at from asof),
        'outstandingSatang',coalesce((select sum(amount) from remaining where membership_id=(select membership_id from viewer)),0)::numeric::text,
        'owedToMeSatang',coalesce((select sum(amount) from remaining where recipient_membership_id=(select membership_id from viewer)),0)::numeric::text,
        'pendingSatang',coalesce((select sum(amount_satang)::numeric from pending where payer_membership_id=(select membership_id from viewer)),0)::numeric::text,
        'pendingPayments',coalesce((select jsonb_agg(item order by id) from (
          select p.id,jsonb_build_object('id',p.id,'billId',p.bill_id,'payerMembershipId',p.payer_membership_id,
            'method',p.method,'amountSatang',p.amount_satang,'status',p.status,'version',p.version,
            'createdAt',p.created_at,'expiresAt',p.expires_at) ||
            case when p.reservation_released_at is null and p.reservation_until>(select at from asof)
              then jsonb_build_object('reservationExpiresAt',least(p.reservation_until,p.expires_at)) else '{}'::jsonb end ||
            case when p.status='confirmed' then jsonb_build_object('confirmedAt',(
              select c.created_at from core.payment_confirmations c where c.house_id=p.house_id and c.attempt_id=p.id
            )) else '{}'::jsonb end ||
            case when p.decision_by_membership_id is null then '{}'::jsonb else jsonb_build_object('decisionByMembershipId',p.decision_by_membership_id) end ||
            case when p.decided_at is null then '{}'::jsonb else jsonb_build_object('decidedAt',p.decided_at) end ||
            case when p.rejection_reason is null then '{}'::jsonb else jsonb_build_object('rejectionReason',p.rejection_reason) end item
          from pending p order by p.id limit 20
        ) payments),'[]'::jsonb),
        'todayChores',coalesce((select jsonb_agg(item order by id) from (select item,id from chore_rows order by id limit 20) chores),'[]'::jsonb),
        'cashAwaitingDecisionCount',(select count(*)::integer from core.payment_attempts p
          join core.bills b on b.house_id=p.house_id and b.id=p.bill_id
          where p.house_id=$1::uuid and b.creator_membership_id=(select membership_id from viewer)
            and p.method='cash' and p.status='awaiting_confirmation'
            and p.reservation_released_at is null and p.reservation_until>(select at from asof)
            and p.expires_at>(select at from asof) and b.expires_at>(select at from asof))
      ) data`,
      [houseId],
    );
  }
  async chore(houseId: UUID, id: UUID) {
    return this.readJson<ChoreRecord>("select core.resource('chore',$1::uuid,$2::uuid) as data", [
      houseId,
      id,
    ]);
  }
  async chores(houseId: UUID, options: ChoreListOptions = {}): Promise<CorePage<ChoreProjection>> {
    const { limit, cursor } = this.listOptions(options);
    const fromDate = this.dateOnly(options.fromDate);
    const toDate = this.dateOnly(options.toDate);
    if (fromDate && toDate && fromDate > toDate) throw new DataError('validation_error');
    await this.ensureMember(houseId);
    return this.readPage<ChoreProjection>(
      `with cursor_row as (
         select local_date,id from core.chore_occurrences where house_id=$1::uuid and id=$3::uuid
       )
       select coalesce(jsonb_agg(item order by local_date,id),'[]'::jsonb) data from (
        select o.id,o.local_date,jsonb_build_object(
          'id',o.id,'houseId',o.house_id,'scheduleId',o.schedule_id,'title',o.title,
          'localDate',o.local_date,'assigneeMembershipId',o.assignee_membership_id,
          'status',o.status,'version',o.version,'expiresAt',o.expires_at,
          'assignmentState',case when o.assignee_membership_id is null then 'unassigned' else 'assigned' end,
          'completedAt',o.completed_at
        ) || case when o.emoji is null then '{}'::jsonb else jsonb_build_object('emoji',o.emoji) end ||
        case when ce.actor_membership_id is null then '{}'::jsonb
          else jsonb_build_object('completedByMembershipId',ce.actor_membership_id) end item
        from core.chore_occurrences o
        left join lateral (
          select actor_membership_id from core.chore_completion_events e
          where e.house_id=o.house_id and e.occurrence_id=o.id and e.action='completed'
          order by e.transition_version desc limit 1
        ) ce on true
        where o.house_id=$1::uuid and o.expires_at>statement_timestamp()
          and ($3::uuid is null or (o.local_date,o.id)>(select local_date,id from cursor_row))
          and ($4::date is null or o.local_date>=$4::date)
          and ($5::date is null or o.local_date<=$5::date)
        order by o.local_date,o.id limit $2::integer
      ) page_rows`,
      [houseId, limit + 1, cursor ?? null, fromDate, toDate],
      limit,
    );
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
  async payments(
    houseId: UUID,
    billId: UUID,
    options: ListOptions = {},
  ): Promise<CorePage<PaymentSummaryProjection>> {
    const { limit, cursor } = this.listOptions(options);
    await this.ensureMember(houseId);
    await this.bill(houseId, billId);
    return this.readPage<PaymentSummaryProjection>(
      `with viewer as (select core.member($1::uuid) id),
       cursor_row as (select created_at,id from core.payment_attempts where house_id=$1::uuid and bill_id=$2::uuid and id=$4::uuid)
       select coalesce(jsonb_agg(item order by created_at,id),'[]'::jsonb) data from (
         select p.id,p.created_at,jsonb_build_object(
           'id',p.id,'billId',p.bill_id,'payerMembershipId',p.payer_membership_id,
           'method',p.method,'amountSatang',p.amount_satang,'status',p.status,
           'version',p.version,'createdAt',p.created_at,'expiresAt',p.expires_at
         ) || case when p.reservation_released_at is null and p.reservation_until>statement_timestamp()
             then jsonb_build_object('reservationExpiresAt',least(p.reservation_until,p.expires_at)) else '{}'::jsonb end ||
           case when p.status='confirmed' then jsonb_build_object('confirmedAt',(
             select c.created_at from core.payment_confirmations c
             where c.house_id=p.house_id and c.attempt_id=p.id
           )) else '{}'::jsonb end ||
           case when p.decision_by_membership_id is null then '{}'::jsonb
             else jsonb_build_object('decisionByMembershipId',p.decision_by_membership_id) end ||
           case when p.decided_at is null then '{}'::jsonb else jsonb_build_object('decidedAt',p.decided_at) end ||
           case when p.rejection_reason is null then '{}'::jsonb else jsonb_build_object('rejectionReason',p.rejection_reason) end item
         from core.payment_attempts p
         join core.bills b on b.house_id=p.house_id and b.id=p.bill_id
         where p.house_id=$1::uuid and p.bill_id=$2::uuid
           and p.expires_at>statement_timestamp() and b.expires_at>statement_timestamp()
           and (p.payer_membership_id=(select id from viewer)
             or (b.creator_membership_id=(select id from viewer) and p.method='cash'
               and p.status='awaiting_confirmation'))
           and ($4::uuid is null or (p.created_at,p.id)>(select created_at,id from cursor_row))
         order by p.created_at,p.id limit $3::integer
       ) page_rows`,
      [houseId, billId, limit + 1, cursor ?? null],
      limit,
    );
  }
  async activity(houseId: UUID, options: ListOptions = {}): Promise<CorePage<ActivityProjection>> {
    const { limit, cursor } = this.listOptions(options);
    await this.ensureMember(houseId);
    return this.readPage<ActivityProjection>(
      `with cursor_row as (
         select created_at,id from core.activity_events
         where house_id=$1::uuid and id=$3::uuid
       )
       select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb) data from (
         select ae.id,ae.created_at,jsonb_build_object(
           'id',ae.id,'houseId',ae.house_id,'kind',ae.event_type,
           'summary',case
             when ae.occurrence_id is not null then o.title
             when ae.bill_id is not null then b.title
             else ae.event_type
           end,
           'createdAt',ae.created_at,'expiresAt',ae.expires_at
         ) item
         from core.activity_events ae
         left join core.bills b on b.house_id=ae.house_id and b.id=ae.bill_id
         left join core.chore_occurrences o on o.house_id=ae.house_id and o.id=ae.occurrence_id
         where ae.house_id=$1::uuid and ae.expires_at>statement_timestamp()
           and (ae.bill_id is null or b.expires_at>statement_timestamp())
           and (ae.occurrence_id is null or o.expires_at>statement_timestamp())
           and ($3::uuid is null or (ae.created_at,ae.id)<(select created_at,id from cursor_row))
         order by ae.created_at desc,ae.id desc limit $2::integer
       ) page_rows`,
      [houseId, limit + 1, cursor ?? null],
      limit,
    );
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
