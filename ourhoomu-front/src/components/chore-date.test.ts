import { describe, expect, test } from 'bun:test';
import { calendarDays, formatThaiDate, moveMonth, parseChoreDate, toDateKey } from './chore-date';

describe('chore calendar dates', () => {
  test('accepts real ISO calendar days, including leap days', () => {
    expect(parseChoreDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseChoreDate('2025-02-29')).toBeNull();
    expect(parseChoreDate('2024-04-31')).toBeNull();
    expect(parseChoreDate('2024-2-09')).toBeNull();
    expect(parseChoreDate('0000-01-01')).toBeNull();
  });

  test('places leap February days under the correct weekday without local timezone shifts', () => {
    const days = calendarDays(2024, 2);
    expect(days.slice(0, 7)).toEqual([null, null, null, null, 1, 2, 3]);
    expect(days[32]).toBe(29);
    expect(days.length).toBe(35);
  });

  test('moves across year boundaries and keeps four-digit ISO values', () => {
    expect(moveMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(moveMonth(2025, 12, 1)).toEqual({ year: 2026, month: 1 });
    expect(toDateKey(2026, 1, 5)).toBe('2026-01-05');
  });

  test('formats the selected date in Thai with the Buddhist year', () => {
    expect(formatThaiDate('2024-02-29')).toBe('29 กุมภาพันธ์ 2567');
  });
});
