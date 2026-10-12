export type Member = { id: string; name: string; avatar: string; role: 'owner' | 'member' };
export type House = {
  id: string;
  name: string;
  subtitle: string;
  members: Member[];
  inviteCode: string;
};
export type Share = { memberId: string; bps: number; amountSatang: number };
export type PaymentAttempt = {
  id: string;
  payerId: string;
  amountSatang: number;
  method: 'cash' | 'transfer_demo';
  status: 'awaiting_confirmation' | 'pending_verification';
  createdAt: string;
};
export type Bill = {
  id: string;
  houseId: string;
  title: string;
  emoji: string;
  amountSatang: number;
  creatorId: string;
  recipientId: string;
  dueDate?: string;
  shares: Share[];
  payments: PaymentAttempt[];
  createdAt: string;
};
export type ChoreMode = 'manual' | 'repeat' | 'rotation';
export type Chore = {
  id: string;
  houseId: string;
  title: string;
  emoji: string;
  date: string;
  assigneeId: string;
  mode: ChoreMode;
  completedAt?: string;
};
export type Activity = {
  id: string;
  houseId: string;
  text: string;
  emoji: string;
  createdAt: string;
};
export type DemoState = {
  entered: boolean;
  activeHouseId: string;
  houses: House[];
  bills: Bill[];
  chores: Chore[];
  activity: Activity[];
};
