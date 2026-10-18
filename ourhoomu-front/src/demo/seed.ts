import type { DemoState } from './types';
import { allocateShares } from './money';

export const CURRENT_MEMBER_ID = 'mew';
export function dateOffset(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function makeSeed(): DemoState {
  const now = new Date().toISOString();
  return {
    entered: false,
    activeHouseId: 'mali',
    houses: [
      {
        id: 'mali',
        name: 'บ้านมะลิ',
        subtitle: 'บ้านที่เราเติบโตไปด้วยกัน',
        inviteCode: 'MALI',
        members: [
          { id: 'mew', name: 'มิว', avatar: 'ม', role: 'owner' },
          { id: 'beam', name: 'บีม', avatar: 'บ', role: 'member' },
          { id: 'fah', name: 'ฟ้า', avatar: 'ฟ', role: 'member' },
        ],
      },
      {
        id: 'peach',
        name: 'บ้านพีช',
        subtitle: 'พื้นที่เล็ก ๆ ของวันหยุด',
        inviteCode: 'PEACH',
        members: [
          { id: 'mew', name: 'มิว', avatar: 'ม', role: 'member' },
          { id: 'pam', name: 'แพม', avatar: 'พ', role: 'owner' },
        ],
      },
    ],
    bills: [
      {
        id: 'bill-grocery',
        houseId: 'mali',
        title: 'ของเข้าบ้าน',
        emoji: '🧺',
        amountSatang: 125000,
        creatorId: 'mew',
        recipientId: 'mew',
        dueDate: dateOffset(7),
        shares: allocateShares(125000, { mew: 4000, beam: 3000, fah: 3000 }),
        payments: [],
        createdAt: now,
      },
      {
        id: 'bill-pizza',
        houseId: 'mali',
        title: 'พิซซ่าวันศุกร์',
        emoji: '🍕',
        amountSatang: 60000,
        creatorId: 'beam',
        recipientId: 'beam',
        dueDate: dateOffset(10),
        shares: allocateShares(60000, { mew: 5000, beam: 5000 }),
        payments: [],
        createdAt: now,
      },
      {
        id: 'bill-plants',
        houseId: 'peach',
        title: 'ต้นไม้หน้าบ้าน',
        emoji: '🪴',
        amountSatang: 42000,
        creatorId: 'pam',
        recipientId: 'pam',
        shares: allocateShares(42000, { mew: 5000, pam: 5000 }),
        payments: [],
        createdAt: now,
      },
    ],
    chores: [
      {
        id: 'chore-1',
        houseId: 'mali',
        title: 'รดน้ำต้นไม้',
        emoji: '🪴',
        date: dateOffset(0),
        assigneeId: 'mew',
        mode: 'repeat',
      },
      {
        id: 'chore-2',
        houseId: 'mali',
        title: 'ล้างจานหลังมื้อเย็น',
        emoji: '🍽️',
        date: dateOffset(0),
        assigneeId: 'beam',
        mode: 'rotation',
      },
      {
        id: 'chore-3',
        houseId: 'mali',
        title: 'เก็บห้องนั่งเล่น',
        emoji: '🧹',
        date: dateOffset(1),
        assigneeId: 'fah',
        mode: 'manual',
      },
      {
        id: 'chore-4',
        houseId: 'peach',
        title: 'เปิดหน้าต่างรับลม',
        emoji: '🌿',
        date: dateOffset(0),
        assigneeId: 'mew',
        mode: 'manual',
      },
    ],
    activity: [
      { id: 'a1', houseId: 'mali', text: 'บีมเพิ่มบิลพิซซ่าวันศุกร์', emoji: '🍕', createdAt: now },
      { id: 'a2', houseId: 'mali', text: 'บ้านมะลิมีเวรใหม่แล้ว', emoji: '✨', createdAt: now },
    ],
  };
}
