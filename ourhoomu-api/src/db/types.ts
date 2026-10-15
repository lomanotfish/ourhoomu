import type { Participant } from './money';
export type UUID = string;
export type Digest = string;
export type Versioned = { expectedVersion: number };
export type HouseCreate = { name: string; timezone: string };
export type AccountWrite = {
  bankCode: string;
  identifierKind: 'bank_account' | 'promptpay';
  identifierCiphertext: string;
  identifierDigest: Digest;
  keyVersion: number;
  label: string;
  maskedAccount: string;
  isDefault?: boolean;
};
export type BillWrite = {
  title: string;
  emoji?: string;
  totalSatang: number;
  currency: 'THB';
  recipientMembershipId: UUID;
  participants: Participant[];
  dueDate: string;
};
export type ChoreRule = {
  mode: 'repeat' | 'rotation';
  timezone: string;
  anchorDate: string;
  startDate: string;
  endDate?: string;
  interval: 'daily' | 'weekly';
  weekdays: number[];
  assigneeMembershipIds: UUID[];
};
export type ScheduleWrite = { title: string; emoji?: string; rule: ChoreRule };
export interface Commands {
  'house.create': HouseCreate;
  'house.update': Versioned & HouseCreate;
  'invite.create': { tokenDigest: Digest; replayCiphertext: string };
  'invite.revoke': Record<string, never>;
  'invite.accept': { tokenDigest: Digest };
  'member.leave': Versioned;
  'member.remove': Versioned;
  'member.role': Versioned & { role: 'owner' | 'member' };
  'account.create': AccountWrite;
  'account.update': Versioned & Partial<AccountWrite>;
  'account.archive': Versioned;
  'bill.create': BillWrite;
  'bill.update': Versioned & BillWrite;
  'bill.publish': Versioned & { recipientAccountId: UUID; recipientAccountVersion: number };
  'bill.void': Versioned;
  'payment.reserve': Versioned & { method: 'cash' | 'transfer'; amountSatang: number };
  'payment.cancel': Versioned;
  'cash.confirm': Versioned;
  'cash.reject': Versioned & { reason: string };
  'chore.create': { title: string; emoji?: string; localDate: string; assigneeMembershipId: UUID };
  'chore.complete': Versioned;
  'chore.reopen': Versioned;
  'chore.cancel': Versioned;
  'chore.update': Versioned & { title?: string; assigneeMembershipId: UUID };
  'schedule.create': ScheduleWrite;
  'schedule.update': Versioned & ScheduleWrite & { effectiveFrom: string };
  'schedule.archive': Versioned;
  'schedule.generate': Versioned & { startDate: string; days: number };
  'activity.read': { eventId: UUID };
  'session.revoke': Record<string, never>;
}
export type CommandResult = {
  resourceId: UUID;
  resourceKind:
    | 'house'
    | 'membership'
    | 'invitation'
    | 'account'
    | 'bill'
    | 'payment'
    | 'chore'
    | 'schedule'
    | 'activity'
    | 'session';
  replayed: boolean;
  replayCiphertext: string | null;
};
export type RequestEvidence = Readonly<{ keyDigest: Digest; bodyHash: Digest }>;

// PostgreSQL jsonb rows use SQL column names; ORM list rows keep their inferred camelCase types.
type SnakeCase<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${First extends Lowercase<First> ? First : `_${Lowercase<First>}`}${SnakeCase<Rest>}`
  : S;
type JsonScalar<T> = T extends Date ? string : T extends bigint ? number : T;
type JsonRow<T> = { [K in keyof T as K extends string ? SnakeCase<K> : K]: JsonScalar<T[K]> };
export type ChoreRecord = Omit<
  JsonRow<typeof import('./schema').occurrences.$inferSelect>,
  'retention_deadline_at'
>;
export type PaymentRecord = Omit<
  JsonRow<typeof import('./schema').attempts.$inferSelect>,
  'retention_deadline_at'
>;
export type ShareRecord = Omit<
  JsonRow<typeof import('./schema').shares.$inferSelect>,
  'retention_deadline_at'
> & { confirmed_satang: string; remaining_satang: string | null };
export type MaskedDestination = {
  sourceAccountId: UUID;
  accountVersion: number;
  bankCode: string;
  identifierKind: string;
  maskedAccount: string;
  recipientName: string;
};
export type EncryptedDestination = {
  bankCode: string;
  identifierKind: string;
  identifierCiphertext: string;
  keyVersion: number;
  recipientName: string;
};
export type BillRecord = Omit<
  JsonRow<typeof import('./schema').bills.$inferSelect>,
  'recipient_user_id' | 'retention_deadline_at'
> & {
  shares: ShareRecord[];
  recipientAccountMasked: MaskedDestination | null;
  recipientAccountEncrypted: EncryptedDestination | null;
};
export type MemberProfile = {
  id: UUID;
  houseId: UUID;
  displayName: string;
  role: 'owner' | 'member';
  active: boolean;
  version: number;
};
export type AccountSelectorItem = {
  id: UUID;
  version: number;
  bankCode: string;
  label: string;
  maskedAccount: string;
  isDefault: boolean;
};
export type DashboardTotals = {
  outstandingSatang: string;
  owedToMeSatang: string;
  pendingSatang: string;
};
export type SchedulePreview = {
  timezone: string;
  occurrences: Array<{ localDate: string; assigneeMembershipId: UUID | null }>;
};
