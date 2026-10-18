import type { components, operations } from './dto';

type Schemas = components['schemas'];

export type ApiError = Schemas['Error'];
export type VersionConflictError = Extract<ApiError, { code: 'version_conflict' }>;

export type PaymentSummary = Schemas['PaymentSummary'];
export type CashPaymentSummary = Extract<PaymentSummary, { method: 'cash' }>;
export type TransferPaymentSummary = Extract<PaymentSummary, { method: 'transfer' }>;

export type Dashboard = Schemas['Dashboard'];
export type Bill = Schemas['Bill'];
export type BillListItem = Schemas['BillListItem'];
export type Chore = Schemas['Chore'];
export type ChoreRule = Schemas['ChoreRule'];
export type ChoreSchedule = Schemas['ChoreSchedule'];
export type ChoreSchedulePreview =
  operations['previewChoreSchedule']['responses'][200]['content']['application/json']['data'];
