import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { allocateShares, availableToRequest } from './money';
import { CURRENT_MEMBER_ID, makeSeed } from './seed';
import type { Bill, Chore, ChoreMode, DemoState, House, PaymentAttempt } from './types';

type BillInput = {
  title: string;
  emoji: string;
  amountSatang: number;
  recipientId: string;
  dueDate?: string;
  bpsByMember: Record<string, number>;
};
type ChoreInput = {
  title: string;
  emoji: string;
  startDate: string;
  mode: ChoreMode;
  assigneeIds: string[];
  weekdays: number[];
};
type Repo = {
  state: DemoState;
  house: House;
  memberId: string;
  bills: Bill[];
  chores: Chore[];
  enter: () => void;
  reset: () => void;
  switchHouse: (id: string) => void;
  createHouse: (name: string) => void;
  joinHouse: (code: string) => boolean;
  renameHouse: (name: string) => void;
  createBill: (input: BillInput) => string;
  requestPayment: (billId: string, amountSatang: number, method: PaymentAttempt['method']) => void;
  cancelPayment: (billId: string, attemptId: string) => void;
  createChores: (input: ChoreInput) => void;
  completeChore: (id: string) => boolean;
};
const Context = createContext<Repo | null>(null);
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function previewChores(input: ChoreInput): Pick<Chore, 'date' | 'assigneeId'>[] {
  const [year, month, day] = input.startDate.split('-').map(Number);
  if (!year || !month || !day || !input.assigneeIds.length) return [];
  const dates: Pick<Chore, 'date' | 'assigneeId'>[] = [];
  for (let offset = 0; offset < (input.mode === 'manual' ? 1 : 14); offset++) {
    const date = new Date(year, month - 1, day + offset, 12);
    if (input.mode !== 'manual' && input.weekdays.length && !input.weekdays.includes(date.getDay()))
      continue;
    dates.push({
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      assigneeId:
        input.mode === 'rotation'
          ? input.assigneeIds[dates.length % input.assigneeIds.length]
          : input.assigneeIds[0],
    });
  }
  return dates;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(makeSeed);
  const stateRef = useRef(state);
  stateRef.current = state;
  const house = state.houses.find((h) => h.id === state.activeHouseId) ?? state.houses[0];
  const bills = useMemo(
    () => state.bills.filter((b) => b.houseId === house.id),
    [state.bills, house.id],
  );
  const chores = useMemo(
    () => state.chores.filter((c) => c.houseId === house.id),
    [state.chores, house.id],
  );
  const addActivity = (text: string, emoji: string) => ({
    id: uid(),
    houseId: house.id,
    text,
    emoji,
    createdAt: new Date().toISOString(),
  });
  const repo: Repo = {
    state,
    house,
    memberId: CURRENT_MEMBER_ID,
    bills,
    chores,
    enter: () => setState((s) => ({ ...s, entered: true })),
    reset: () => setState(makeSeed()),
    switchHouse: (id) =>
      setState((s) => (s.houses.some((h) => h.id === id) ? { ...s, activeHouseId: id } : s)),
    createHouse: (name) => {
      const id = uid();
      const next: House = {
        id,
        name: name.trim(),
        subtitle: 'บ้านใหม่ของเรา',
        inviteCode: `HOME-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        members: [{ id: CURRENT_MEMBER_ID, name: 'มิว', avatar: 'ม', role: 'owner' }],
      };
      setState((s) => ({ ...s, activeHouseId: id, houses: [...s.houses, next] }));
    },
    joinHouse: (code) => {
      if (code.trim().toUpperCase() !== 'MINT') return false;
      if (state.houses.some((h) => h.id === 'mint')) {
        setState((s) => ({ ...s, activeHouseId: 'mint' }));
        return true;
      }
      const next: House = {
        id: 'mint',
        name: 'บ้านมิ้นต์',
        subtitle: 'บ้านตัวอย่างสำหรับการเข้าร่วม',
        inviteCode: 'MINT',
        members: [
          { id: 'mew', name: 'มิว', avatar: 'ม', role: 'member' },
          { id: 'nam', name: 'น้ำ', avatar: 'น', role: 'owner' },
        ],
      };
      setState((s) => ({ ...s, activeHouseId: 'mint', houses: [...s.houses, next] }));
      return true;
    },
    renameHouse: (name) =>
      setState((s) => ({
        ...s,
        houses: s.houses.map((h) => (h.id === house.id ? { ...h, name: name.trim() } : h)),
      })),
    createBill: (input) => {
      const id = uid();
      const next: Bill = {
        id,
        houseId: house.id,
        title: input.title.trim(),
        emoji: input.emoji,
        amountSatang: input.amountSatang,
        dueDate: input.dueDate,
        creatorId: CURRENT_MEMBER_ID,
        recipientId: input.recipientId,
        shares: allocateShares(input.amountSatang, input.bpsByMember),
        payments: [],
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({
        ...s,
        bills: [next, ...s.bills],
        activity: [addActivity(`มิวเพิ่มบิล${next.title}`, next.emoji), ...s.activity],
      }));
      return id;
    },
    requestPayment: (billId, amountSatang, method) => {
      const live = stateRef.current;
      const bill = live.bills.find((b) => b.id === billId && b.houseId === house.id);
      if (
        !bill ||
        !Number.isSafeInteger(amountSatang) ||
        amountSatang <= 0 ||
        amountSatang > availableToRequest(bill, CURRENT_MEMBER_ID)
      )
        throw new Error('payment_unavailable');
      const attempt: PaymentAttempt = {
        id: uid(),
        payerId: CURRENT_MEMBER_ID,
        amountSatang,
        method,
        status: method === 'cash' ? 'awaiting_confirmation' : 'pending_verification',
        createdAt: new Date().toISOString(),
      };
      const next = {
        ...live,
        bills: live.bills.map((b) =>
          b.id === billId ? { ...b, payments: [...b.payments, attempt] } : b,
        ),
        activity: [
          addActivity(
            `มิวส่งคำขอ${method === 'cash' ? 'จ่ายเงินสด' : 'โอนเงินตัวอย่าง'}สำหรับ${bill.title}`,
            '🧾',
          ),
          ...live.activity,
        ],
      };
      stateRef.current = next;
      setState(next);
    },
    cancelPayment: (billId, attemptId) =>
      setState((s) => ({
        ...s,
        bills: s.bills.map((b) =>
          b.id === billId
            ? {
                ...b,
                payments: b.payments.filter(
                  (p) => !(p.id === attemptId && p.payerId === CURRENT_MEMBER_ID),
                ),
              }
            : b,
        ),
        activity: [addActivity('มิวถอนคำขอชำระเงินที่ยังรออยู่', '↩️'), ...s.activity],
      })),
    createChores: (input) => {
      const next: Chore[] = previewChores(input).map((item) => ({
        id: uid(),
        houseId: house.id,
        title: input.title.trim(),
        emoji: input.emoji,
        date: item.date,
        assigneeId: item.assigneeId,
        mode: input.mode,
      }));
      setState((s) => ({
        ...s,
        chores: [...s.chores, ...next],
        activity: [
          addActivity(`มิวเพิ่มตารางเวร${input.title.trim()}`, input.emoji),
          ...s.activity,
        ],
      }));
    },
    completeChore: (id) => {
      const chore = state.chores.find((c) => c.id === id && c.houseId === house.id);
      if (!chore || chore.assigneeId !== CURRENT_MEMBER_ID || chore.completedAt) return false;
      setState((s) => ({
        ...s,
        chores: s.chores.map((c) =>
          c.id === id ? { ...c, completedAt: new Date().toISOString() } : c,
        ),
        activity: [addActivity(`มิวทำ${chore.title}เสร็จแล้ว`, '✨'), ...s.activity],
      }));
      return true;
    },
  };
  return <Context.Provider value={repo}>{children}</Context.Provider>;
}

export function useDemo(): Repo {
  const value = useContext(Context);
  if (!value) throw new Error('DemoProvider missing');
  return value;
}
