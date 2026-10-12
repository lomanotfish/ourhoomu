import { describe, expect, test } from 'bun:test';
import {
  allocateShares,
  availableToRequest,
  confirmedRemaining,
  equalBps,
  parseBps,
  parseSatang,
} from './money';
import type { Bill } from './types';

describe('demo money preview', () => {
  test('parses positive integer satang and exact percentage units', () => {
    expect(parseSatang('200')).toBe(20000);
    expect(parseSatang('1,234.56')).toBe(123456);
    expect(parseSatang('0')).toBeNull();
    expect(parseSatang('1.234')).toBeNull();
    expect(parseBps('33.34')).toBe(3334);
    expect(parseBps('0')).toBeNull();
    expect(parseBps('100.01')).toBeNull();
  });

  test('equal thirds and largest remainder always preserve total', () => {
    const bps = equalBps(['c', 'b', 'a']);
    expect(bps).toEqual({ a: 3334, b: 3333, c: 3333 });
    const shares = allocateShares(10000, bps);
    expect(shares.map((s) => s.amountSatang)).toEqual([3334, 3333, 3333]);
    expect(shares.reduce((sum, share) => sum + share.amountSatang, 0)).toBe(10000);
    expect(() => allocateShares(10000, { a: 3333, b: 3333, c: 3333 })).toThrow('invalid_split');
    expect(() => allocateShares(10000, { a: 5000, b: 5001 })).toThrow('invalid_split');
  });

  test('recipient self coverage follows recipient rather than creator; pending reserves without credit', () => {
    const bill: Bill = {
      id: 'b',
      houseId: 'h',
      title: 'test',
      emoji: '🧾',
      amountSatang: 20000,
      creatorId: 'a',
      recipientId: 'b',
      shares: allocateShares(20000, { a: 5000, b: 5000 }),
      payments: [],
      createdAt: '',
    };
    expect(confirmedRemaining(bill, 'a')).toBe(10000);
    expect(confirmedRemaining(bill, 'b')).toBe(0);
    bill.payments.push({
      id: 'p',
      payerId: 'a',
      amountSatang: 4000,
      method: 'cash',
      status: 'awaiting_confirmation',
      createdAt: '',
    });
    expect(confirmedRemaining(bill, 'a')).toBe(10000);
    expect(availableToRequest(bill, 'a')).toBe(6000);
    bill.recipientId = 'outside';
    expect(confirmedRemaining(bill, 'a')).toBe(10000);
    expect(confirmedRemaining(bill, 'b')).toBe(10000);
    expect(confirmedRemaining(bill, 'outside')).toBe(0);
  });
});
