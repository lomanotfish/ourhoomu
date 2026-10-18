import { sql } from 'drizzle-orm';
import {
  pgSchema,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  date,
  primaryKey,
  unique,
  check,
  index,
  foreignKey,
  jsonb,
} from 'drizzle-orm/pg-core';

export const core = pgSchema('core');
const created = () =>
  timestamp('created_at', { withTimezone: true }).notNull().default(sql`statement_timestamp()`);
const version = () => integer('version').notNull().default(1);
const history = () => ({
  createdAt: created(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  retentionDeadlineAt: timestamp('retention_deadline_at', { withTimezone: true }).notNull(),
});

export const users = core.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    displayName: text('display_name').notNull(),
    locale: text('locale').notNull().default('th'),
    state: text('state').notNull().default('active'),
    createdAt: created(),
  },
  (_t) => [
    check(
      'user_valid',
      sql`length(display_name) BETWEEN 1 AND 100 AND locale IN ('th','en') AND state IN ('active','deletion_pending')`,
    ),
  ],
);

export const identities = core.table(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    issuer: text('issuer').notNull(),
    subject: text('subject').notNull(),
    provider: text('provider').notNull(),
    createdAt: created(),
  },
  (t) => [
    unique('identity_issuer_subject').on(t.issuer, t.subject),
    foreignKey({ name: 'identity_user_fk', columns: [t.userId], foreignColumns: [users.id] }),
    check(
      'identity_valid',
      sql`provider IN ('google','apple') AND length(issuer) BETWEEN 1 AND 512 AND length(subject) BETWEEN 1 AND 512`,
    ),
  ],
);

export const challenges = core.table(
  'auth_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    proofDigest: text('proof_digest').notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: created(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    unique('challenge_proof').on(t.proofDigest),
    check(
      'challenge_valid',
      sql`provider IN ('google','apple') AND proof_digest ~ '^[0-9a-f]{64}$' AND expires_at > created_at AND expires_at <= created_at + interval '5 minutes'`,
    ),
  ],
);

export const sessions = core.table(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    identityId: uuid('identity_id').notNull(),
    accessDigest: text('access_digest').notNull(),
    refreshDigest: text('refresh_digest').notNull(),
    familyId: uuid('family_id').notNull(),
    generation: integer('generation').notNull().default(1),
    authTime: timestamp('auth_time', { withTimezone: true }).notNull(),
    createdAt: created(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp('refresh_expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    replayKeyDigest: text('replay_key_digest'),
    replayBodyHash: text('replay_body_hash'),
    replayCiphertext: text('replay_ciphertext'),
    replayUntil: timestamp('replay_until', { withTimezone: true }),
  },
  (t) => [
    foreignKey({ name: 'session_user_fk', columns: [t.userId], foreignColumns: [users.id] }),
    foreignKey({
      name: 'session_identity_fk',
      columns: [t.identityId],
      foreignColumns: [identities.id],
    }),
    unique('session_access').on(t.accessDigest),
    unique('session_refresh').on(t.refreshDigest),
    check(
      'session_valid',
      sql`generation>0 AND access_digest ~ '^[0-9a-f]{64}$' AND refresh_digest ~ '^[0-9a-f]{64}$' AND created_at<expires_at AND expires_at<=refresh_expires_at AND refresh_expires_at<=created_at+interval '8760 hours'`,
    ),
  ],
);

export const houses = core.table(
  'houses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    timezone: text('timezone').notNull().default('Asia/Bangkok'),
    createdByUserId: uuid('created_by_user_id').notNull(),
    state: text('state').notNull().default('active'),
    version: version(),
    createdAt: created(),
  },
  (t) => [
    foreignKey({
      name: 'house_creator_fk',
      columns: [t.createdByUserId],
      foreignColumns: [users.id],
    }),
    check(
      'house_valid',
      sql`length(name) BETWEEN 1 AND 100 AND state IN ('active','archived') AND version>0`,
    ),
  ],
);

export const memberships = core.table(
  'house_memberships',
  {
    houseId: uuid('house_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    userId: uuid('user_id').notNull(),
    role: text('role').notNull().default('member'),
    state: text('state').notNull().default('active'),
    leftAt: timestamp('left_at', { withTimezone: true }),
    archivedExpiresAt: timestamp('archived_expires_at', { withTimezone: true }),
    version: version(),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.id] }),
    unique('memberships_id_unique').on(t.id),
    foreignKey({ name: 'memberships_house_fk', columns: [t.houseId], foreignColumns: [houses.id] }),
    foreignKey({ name: 'member_user_fk', columns: [t.userId], foreignColumns: [users.id] }),
    unique('member_house_user').on(t.houseId, t.userId),
    unique('member_house_id_user').on(t.houseId, t.id, t.userId),
    index('member_user_active').on(t.userId, t.state, t.houseId),
    check(
      'member_valid',
      sql`role IN ('owner','member') AND state IN ('active','left','removed') AND version>0 AND ((state='active' AND left_at IS NULL AND archived_expires_at IS NULL) OR (state<>'active' AND left_at IS NOT NULL AND archived_expires_at>left_at AND archived_expires_at<=left_at+interval '8760 hours'))`,
    ),
  ],
);

export const invitations = core.table(
  'house_invitations',
  {
    houseId: uuid('house_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    creatorMembershipId: uuid('creator_membership_id').notNull(),
    tokenDigest: text('token_digest').notNull(),
    consumedByUserId: uuid('consumed_by_user_id'),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...history(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.id] }),
    unique('invitations_id_unique').on(t.id),
    foreignKey({ name: 'invitations_house_fk', columns: [t.houseId], foreignColumns: [houses.id] }),
    check(
      'invitations_history',
      sql`created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'`,
    ),
    index('invitations_expiry_idx').on(t.expiresAt),
    foreignKey({
      name: 'invite_creator_fk',
      columns: [t.houseId, t.creatorMembershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    foreignKey({
      name: 'invite_consumer_fk',
      columns: [t.consumedByUserId],
      foreignColumns: [users.id],
    }),
    unique('invite_digest').on(t.tokenDigest),
    check(
      'invite_valid',
      sql`token_digest ~ '^[0-9a-f]{64}$' AND expires_at<=created_at+interval '168 hours' AND ((consumed_at IS NULL)=(consumed_by_user_id IS NULL))`,
    ),
  ],
);

export const accounts = core.table(
  'recipient_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id').notNull(),
    bankCode: text('bank_code').notNull(),
    identifierKind: text('identifier_kind').notNull(),
    identifierCiphertext: text('identifier_ciphertext').notNull(),
    identifierDigest: text('identifier_digest').notNull(),
    keyVersion: integer('key_version').notNull(),
    label: text('label').notNull(),
    maskedAccount: text('masked_account').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    state: text('state').notNull().default('active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    archivedExpiresAt: timestamp('archived_expires_at', { withTimezone: true }),
    version: version(),
    createdAt: created(),
  },
  (t) => [
    foreignKey({ name: 'account_user_fk', columns: [t.ownerUserId], foreignColumns: [users.id] }),
    unique('account_owner_pair').on(t.id, t.ownerUserId),
    index('account_owner_idx').on(t.ownerUserId, t.state),
    check(
      'account_valid',
      sql`identifier_kind IN ('bank_account','promptpay') AND identifier_digest ~ '^[0-9a-f]{64}$' AND length(identifier_ciphertext)>0 AND key_version>0 AND length(bank_code) BETWEEN 1 AND 32 AND length(label) BETWEEN 1 AND 100 AND length(masked_account) BETWEEN 1 AND 64 AND state IN ('active','archived') AND version>0 AND ((state='active' AND archived_at IS NULL AND archived_expires_at IS NULL) OR (state='archived' AND archived_at IS NOT NULL AND archived_expires_at>archived_at AND archived_expires_at<=archived_at+interval '8760 hours'))`,
    ),
  ],
);

export const bills = core.table(
  'bills',
  {
    houseId: uuid('house_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    creatorMembershipId: uuid('creator_membership_id').notNull(),
    recipientMembershipId: uuid('recipient_membership_id').notNull(),
    recipientUserId: uuid('recipient_user_id').notNull(),
    title: text('title').notNull(),
    emoji: text('emoji'),
    totalSatang: bigint('total_satang', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull().default('THB'),
    status: text('status').notNull().default('draft'),
    dueDate: date('due_date').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    version: version(),
    ...history(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.id] }),
    unique('bills_id_unique').on(t.id),
    foreignKey({ name: 'bills_house_fk', columns: [t.houseId], foreignColumns: [houses.id] }),
    check(
      'bills_history',
      sql`created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'`,
    ),
    index('bills_expiry_idx').on(t.expiresAt),
    foreignKey({
      name: 'bill_creator_fk',
      columns: [t.houseId, t.creatorMembershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    foreignKey({
      name: 'bill_recipient_fk',
      columns: [t.houseId, t.recipientMembershipId, t.recipientUserId],
      foreignColumns: [memberships.houseId, memberships.id, memberships.userId],
    }),
    unique('bill_recipient_tuple').on(t.houseId, t.id, t.recipientMembershipId, t.recipientUserId),
    index('bill_feed_idx').on(t.houseId, t.createdAt, t.id),
    check(
      'bill_valid',
      sql`total_satang BETWEEN 1 AND 900000000000 AND currency='THB' AND length(title) BETWEEN 1 AND 200 AND status IN ('draft','open','settled','voided') AND version>0 AND (emoji IS NULL OR length(emoji)<=8)`,
    ),
  ],
);

export const snapshots = core.table(
  'bill_recipient_snapshots',
  {
    houseId: uuid('house_id').notNull(),
    billId: uuid('bill_id').notNull(),
    recipientMembershipId: uuid('recipient_membership_id').notNull(),
    recipientUserId: uuid('recipient_user_id').notNull(),
    sourceAccountId: uuid('source_account_id').notNull(),
    accountVersion: integer('account_version').notNull(),
    bankCode: text('bank_code').notNull(),
    identifierKind: text('identifier_kind').notNull(),
    identifierCiphertext: text('identifier_ciphertext').notNull(),
    identifierDigest: text('identifier_digest').notNull(),
    keyVersion: integer('key_version').notNull(),
    maskedAccount: text('masked_account').notNull(),
    recipientName: text('recipient_name').notNull(),
    ...history(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.billId] }),
    foreignKey({
      name: 'snapshot_bill_recipient_fk',
      columns: [t.houseId, t.billId, t.recipientMembershipId, t.recipientUserId],
      foreignColumns: [bills.houseId, bills.id, bills.recipientMembershipId, bills.recipientUserId],
    }),
    check(
      'snapshots_history',
      sql`created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'`,
    ),
    index('snapshots_expiry_idx').on(t.expiresAt),
  ],
);

export const shares = core.table(
  'bill_shares',
  {
    houseId: uuid('house_id').notNull(),
    billId: uuid('bill_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    basisPoints: integer('basis_points').notNull(),
    amountSatang: bigint('amount_satang', { mode: 'bigint' }),
    selfCovered: boolean('self_covered').notNull().default(false),
    memberName: text('member_name').notNull(),
    ...history(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.billId, t.membershipId] }),
    foreignKey({
      name: 'share_bill_fk',
      columns: [t.houseId, t.billId],
      foreignColumns: [bills.houseId, bills.id],
    }),
    foreignKey({
      name: 'share_member_fk',
      columns: [t.houseId, t.membershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    check(
      'share_valid',
      sql`basis_points BETWEEN 1 AND 10000 AND (amount_satang IS NULL OR amount_satang BETWEEN 0 AND 900000000000) AND (NOT self_covered OR amount_satang IS NOT NULL)`,
    ),
    check(
      'shares_history',
      sql`created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'`,
    ),
    index('shares_expiry_idx').on(t.expiresAt),
  ],
);

export const attempts = core.table(
  'payment_attempts',
  {
    houseId: uuid('house_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    billId: uuid('bill_id').notNull(),
    payerMembershipId: uuid('payer_membership_id').notNull(),
    method: text('method').notNull(),
    amountSatang: bigint('amount_satang', { mode: 'bigint' }).notNull(),
    status: text('status').notNull(),
    reservationUntil: timestamp('reservation_until', { withTimezone: true }).notNull(),
    reservationReleasedAt: timestamp('reservation_released_at', { withTimezone: true }),
    decisionByMembershipId: uuid('decision_by_membership_id'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    version: version(),
    ...history(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.id] }),
    unique('attempts_id_unique').on(t.id),
    foreignKey({ name: 'attempts_house_fk', columns: [t.houseId], foreignColumns: [houses.id] }),
    foreignKey({
      name: 'attempt_share_fk',
      columns: [t.houseId, t.billId, t.payerMembershipId],
      foreignColumns: [shares.houseId, shares.billId, shares.membershipId],
    }),
    foreignKey({
      name: 'attempt_decider_fk',
      columns: [t.houseId, t.decisionByMembershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    unique('attempt_bill_payer_tuple').on(t.houseId, t.billId, t.id, t.payerMembershipId),
    index('attempt_reserved_idx').on(
      t.houseId,
      t.billId,
      t.payerMembershipId,
      t.status,
      t.reservationUntil,
    ),
    check(
      'attempt_valid',
      sql`amount_satang BETWEEN 1 AND 900000000000 AND version>0 AND created_at<reservation_until AND reservation_until<=expires_at AND ((method='cash' AND status IN ('awaiting_confirmation','confirmed','rejected','cancelled')) OR (method='transfer' AND status IN ('awaiting_upload','verifying','pending_verification','needs_attention','cancelled'))) AND (status NOT IN ('confirmed','rejected','cancelled') OR reservation_released_at IS NOT NULL)`,
    ),
    check(
      'attempts_history',
      sql`created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'`,
    ),
    index('attempts_expiry_idx').on(t.expiresAt),
  ],
);

export const confirmations = core.table(
  'payment_confirmations',
  {
    houseId: uuid('house_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    billId: uuid('bill_id').notNull(),
    attemptId: uuid('attempt_id').notNull(),
    payerMembershipId: uuid('payer_membership_id').notNull(),
    actorMembershipId: uuid('actor_membership_id').notNull(),
    amountSatang: bigint('amount_satang', { mode: 'bigint' }).notNull(),
    selfConfirmed: boolean('self_confirmed').notNull(),
    ...history(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.id] }),
    unique('confirmations_id_unique').on(t.id),
    foreignKey({
      name: 'confirmations_house_fk',
      columns: [t.houseId],
      foreignColumns: [houses.id],
    }),
    foreignKey({
      name: 'confirmation_attempt_fk',
      columns: [t.houseId, t.billId, t.attemptId, t.payerMembershipId],
      foreignColumns: [attempts.houseId, attempts.billId, attempts.id, attempts.payerMembershipId],
    }),
    foreignKey({
      name: 'confirmation_actor_fk',
      columns: [t.houseId, t.actorMembershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    unique('confirmation_once').on(t.houseId, t.attemptId),
    check('credit_valid', sql`amount_satang BETWEEN 1 AND 900000000000`),
    check(
      'confirmations_history',
      sql`created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'`,
    ),
    index('confirmations_expiry_idx').on(t.expiresAt),
  ],
);

export const schedules = core.table(
  'chore_schedules',
  {
    houseId: uuid('house_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    creatorMembershipId: uuid('creator_membership_id').notNull(),
    activeRevision: integer('active_revision').notNull().default(1),
    state: text('state').notNull().default('active'),
    version: version(),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.id] }),
    unique('schedules_id_unique').on(t.id),
    foreignKey({ name: 'schedules_house_fk', columns: [t.houseId], foreignColumns: [houses.id] }),
    foreignKey({
      name: 'schedule_creator_fk',
      columns: [t.houseId, t.creatorMembershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    check(
      'schedule_valid',
      sql`version>0 AND active_revision>0 AND state IN ('active','archived')`,
    ),
  ],
);

export const revisions = core.table(
  'chore_revisions',
  {
    houseId: uuid('house_id').notNull(),
    scheduleId: uuid('schedule_id').notNull(),
    revision: integer('revision').notNull(),
    title: text('title').notNull(),
    emoji: text('emoji'),
    mode: text('mode').notNull(),
    timezone: text('timezone').notNull(),
    anchorDate: date('anchor_date').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    frequency: text('frequency').notNull(),
    weekdays: integer('weekdays').array().notNull(),
    createdAt: created(),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    archiveExpiresAt: timestamp('archive_expires_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.scheduleId, t.revision] }),
    foreignKey({
      name: 'revision_schedule_fk',
      columns: [t.houseId, t.scheduleId],
      foreignColumns: [schedules.houseId, schedules.id],
    }),
    check(
      'revision_valid',
      sql`revision>0 AND length(title) BETWEEN 1 AND 200 AND mode IN ('repeat','rotation') AND frequency IN ('daily','weekly') AND anchor_date<=start_date AND (end_date IS NULL OR end_date>=start_date) AND weekdays <@ ARRAY[0,1,2,3,4,5,6] AND ((frequency='daily' AND cardinality(weekdays)=0) OR (frequency='weekly' AND cardinality(weekdays)>0))`,
    ),
  ],
);

export const rotationMembers = core.table(
  'chore_rotation_members',
  {
    houseId: uuid('house_id').notNull(),
    scheduleId: uuid('schedule_id').notNull(),
    revision: integer('revision').notNull(),
    position: integer('position').notNull(),
    membershipId: uuid('membership_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.scheduleId, t.revision, t.position] }),
    foreignKey({
      name: 'rotation_revision_fk',
      columns: [t.houseId, t.scheduleId, t.revision],
      foreignColumns: [revisions.houseId, revisions.scheduleId, revisions.revision],
    }),
    foreignKey({
      name: 'rotation_member_fk',
      columns: [t.houseId, t.membershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    unique('rotation_member_unique').on(t.houseId, t.scheduleId, t.revision, t.membershipId),
    check('rotation_valid', sql`position>=0`),
  ],
);

export const occurrences = core.table(
  'chore_occurrences',
  {
    houseId: uuid('house_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    scheduleId: uuid('schedule_id'),
    scheduleRevision: integer('schedule_revision'),
    localDate: date('local_date').notNull(),
    timezone: text('timezone').notNull(),
    title: text('title').notNull(),
    emoji: text('emoji'),
    creatorMembershipId: uuid('creator_membership_id').notNull(),
    assigneeMembershipId: uuid('assignee_membership_id'),
    assigneeName: text('assignee_name'),
    status: text('status').notNull().default('pending'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    rotationOrdinal: bigint('rotation_ordinal', { mode: 'bigint' }),
    version: version(),
    ...history(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.id] }),
    unique('occurrences_id_unique').on(t.id),
    foreignKey({ name: 'occurrences_house_fk', columns: [t.houseId], foreignColumns: [houses.id] }),
    foreignKey({
      name: 'occurrence_revision_fk',
      columns: [t.houseId, t.scheduleId, t.scheduleRevision],
      foreignColumns: [revisions.houseId, revisions.scheduleId, revisions.revision],
    }),
    foreignKey({
      name: 'occurrence_creator_fk',
      columns: [t.houseId, t.creatorMembershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    foreignKey({
      name: 'occurrence_assignee_fk',
      columns: [t.houseId, t.assigneeMembershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    unique('occurrence_schedule_date').on(t.houseId, t.scheduleId, t.localDate),
    index('occurrence_dates_idx').on(t.houseId, t.localDate, t.id),
    check(
      'occurrence_valid',
      sql`version>0 AND length(title) BETWEEN 1 AND 200 AND status IN ('pending','completed','cancelled') AND ((schedule_id IS NULL)=(schedule_revision IS NULL)) AND ((status='completed')=(completed_at IS NOT NULL)) AND (status<>'completed' OR assignee_membership_id IS NOT NULL)`,
    ),
    check(
      'occurrences_history',
      sql`created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'`,
    ),
    index('occurrences_expiry_idx').on(t.expiresAt),
  ],
);

export const completionEvents = core.table(
  'chore_completion_events',
  {
    houseId: uuid('house_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    occurrenceId: uuid('occurrence_id').notNull(),
    actorMembershipId: uuid('actor_membership_id').notNull(),
    transitionVersion: integer('transition_version').notNull(),
    action: text('action').notNull(),
    ...history(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.id] }),
    unique('completion_events_id_unique').on(t.id),
    foreignKey({
      name: 'completion_events_house_fk',
      columns: [t.houseId],
      foreignColumns: [houses.id],
    }),
    foreignKey({
      name: 'completion_occurrence_fk',
      columns: [t.houseId, t.occurrenceId],
      foreignColumns: [occurrences.houseId, occurrences.id],
    }),
    foreignKey({
      name: 'completion_actor_fk',
      columns: [t.houseId, t.actorMembershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    unique('completion_once').on(t.houseId, t.occurrenceId, t.transitionVersion),
    check('completion_valid', sql`transition_version>0 AND action IN ('completed','reopened')`),
    check(
      'completion_events_history',
      sql`created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'`,
    ),
    index('completion_events_expiry_idx').on(t.expiresAt),
  ],
);

export const activities = core.table(
  'activity_events',
  {
    houseId: uuid('house_id').notNull(),
    id: uuid('id').notNull().defaultRandom(),
    actorMembershipId: uuid('actor_membership_id').notNull(),
    eventType: text('event_type').notNull(),
    billId: uuid('bill_id'),
    occurrenceId: uuid('occurrence_id'),
    confirmationId: uuid('confirmation_id'),
    ...history(),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.id] }),
    unique('activities_id_unique').on(t.id),
    foreignKey({ name: 'activities_house_fk', columns: [t.houseId], foreignColumns: [houses.id] }),
    foreignKey({
      name: 'activity_actor_fk',
      columns: [t.houseId, t.actorMembershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    foreignKey({
      name: 'activity_bill_fk',
      columns: [t.houseId, t.billId],
      foreignColumns: [bills.houseId, bills.id],
    }),
    foreignKey({
      name: 'activity_occurrence_fk',
      columns: [t.houseId, t.occurrenceId],
      foreignColumns: [occurrences.houseId, occurrences.id],
    }),
    index('activity_feed_idx').on(t.houseId, t.createdAt, t.id),
    check(
      'activity_valid',
      sql`NOT(bill_id IS NOT NULL AND occurrence_id IS NOT NULL) AND (confirmation_id IS NULL OR bill_id IS NOT NULL)`,
    ),
    check(
      'activities_history',
      sql`created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'`,
    ),
    index('activities_expiry_idx').on(t.expiresAt),
  ],
);

export const readCursors = core.table(
  'activity_read_state',
  {
    houseId: uuid('house_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    lastSeenId: uuid('last_seen_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`statement_timestamp()`),
  },
  (t) => [
    primaryKey({ columns: [t.houseId, t.membershipId] }),
    foreignKey({
      name: 'cursor_member_fk',
      columns: [t.houseId, t.membershipId],
      foreignColumns: [memberships.houseId, memberships.id],
    }),
    check('cursor_valid', sql`((last_seen_at IS NULL)=(last_seen_id IS NULL))`),
  ],
);

export const idempotency = core.table(
  'idempotency_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').notNull(),
    houseId: uuid('house_id'),
    routeScope: text('route_scope').notNull(),
    keyDigest: text('key_digest').notNull(),
    requestHash: text('request_hash').notNull(),
    resourceKind: text('resource_kind').notNull(),
    resourceId: uuid('resource_id').notNull(),
    replayCiphertext: text('replay_ciphertext'),
    resultData: jsonb('result_data'),
    replayUntil: timestamp('replay_until', { withTimezone: true }),
    ...history(),
  },
  (t) => [
    foreignKey({
      name: 'idempotency_user_fk',
      columns: [t.actorUserId],
      foreignColumns: [users.id],
    }),
    foreignKey({ name: 'idempotency_house_fk', columns: [t.houseId], foreignColumns: [houses.id] }),
    unique('idempotency_key').on(t.actorUserId, t.routeScope, t.keyDigest),
    check(
      'idempotency_valid',
      sql`key_digest ~ '^[0-9a-f]{64}$' AND request_hash ~ '^[0-9a-f]{64}$' AND length(route_scope) BETWEEN 1 AND 300 AND (replay_until IS NULL OR replay_until<=created_at+interval '5 minutes')`,
    ),
    check(
      'idempotency_history',
      sql`created_at < expires_at AND expires_at <= retention_deadline_at - interval '24 hours' AND retention_deadline_at <= created_at + interval '8760 hours'`,
    ),
    index('idempotency_expiry_idx').on(t.expiresAt),
  ],
);

/** Anonymous HTTP retry locators: no raw credentials, nonce, account or identity. */
export const authRequestLocators = core
  .table(
    'auth_request_locators',
    {
      route: text('route').notNull(),
      keyDigest: text('key_digest').notNull(),
      bodyHash: text('body_hash').notNull(),
      challengeId: uuid('challenge_id').notNull(),
      sessionId: uuid('session_id'),
      replayCiphertext: text('replay_ciphertext'),
      replayUntil: timestamp('replay_until', { withTimezone: true }),
      createdAt: created(),
      expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    },
    (t) => [
      primaryKey({ name: 'auth_request_locators_pkey', columns: [t.route, t.keyDigest] }),
      foreignKey({
        name: 'auth_request_locators_session_id_fkey',
        columns: [t.sessionId],
        foreignColumns: [sessions.id],
      }),
      check('auth_request_locators_route_check', sql`route IN ('challenge','exchange')`),
      check('auth_request_locators_key_digest_check', sql`key_digest ~ '^[0-9a-f]{64}$'`),
      check('auth_request_locators_body_hash_check', sql`body_hash ~ '^[0-9a-f]{64}$'`),
      check(
        'auth_request_locators_check',
        sql`expires_at>created_at AND expires_at<=created_at+interval '24 hours'`,
      ),
      check(
        'auth_request_locators_check1',
        sql`(route='challenge' AND session_id IS NULL AND replay_ciphertext IS NULL AND replay_until IS NULL) OR (route='exchange' AND session_id IS NOT NULL AND replay_until>created_at AND replay_until<=created_at+interval '5 minutes')`,
      ),
      index('auth_locator_expiry').on(t.expiresAt),
    ],
  )
  .enableRLS();

/** Migration-only reversal metadata, inaccessible to both runtime credentials. */
export const httpSeamMigrationState = core
  .table(
    'http_seam_migration_state',
    {
      singleton: boolean('singleton').primaryKey().default(true),
      commandDefinition: text('command_definition').notNull(),
      clearDefinition: text('clear_definition').notNull(),
      migrationSha: text('migration_sha'),
      appliedHashes: jsonb('applied_hashes'),
    },
    () => [check('http_seam_migration_state_singleton_check', sql`singleton`)],
  )
  .enableRLS();
