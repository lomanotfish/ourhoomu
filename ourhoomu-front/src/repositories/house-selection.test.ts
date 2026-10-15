import { expect, test } from 'bun:test';
import { selectHouse } from './house-selection';
import type { House } from './contracts';

const a: House = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'A',
  timezone: 'Asia/Bangkok',
  version: 1,
};
const b: House = { ...a, id: '550e8400-e29b-41d4-a716-446655440002', name: 'B' };

test('pending invitation precedes entry and revoked choice recovery', () => {
  expect(selectHouse({ houses: [a], persistedHouseId: b.id, pendingInvitation: true })).toEqual({
    status: 'invitation_pending',
  });
});

test('zero, one and many authorized houses have distinct entry decisions', () => {
  expect(selectHouse({ houses: [] })).toEqual({ status: 'create_or_join' });
  expect(selectHouse({ houses: [a] })).toEqual({ status: 'enter', house: a });
  expect(selectHouse({ houses: [a, b] })).toEqual({ status: 'choose', houses: [a, b] });
});

test('persisted choice is used only when still authorized', () => {
  expect(selectHouse({ houses: [a, b], persistedHouseId: b.id })).toEqual({
    status: 'enter',
    house: b,
  });
  for (const houses of [[], [a], [a, { ...b, id: '550e8400-e29b-41d4-a716-446655440003' }]]) {
    expect(selectHouse({ houses, persistedHouseId: b.id })).toEqual({
      status: 'recovery_required',
      unavailableHouseId: b.id,
      houses,
    });
  }
  expect(selectHouse({ houses: [a], persistedHouseId: '' }).status).toBe('recovery_required');
});
