import { expect, test } from 'bun:test';
import { allocateShares } from '../../src/db/money';

test('allocates largest remainder exactly, deterministic on member ID ties', () => {
  expect(
    allocateShares(10001, [
      { membershipId: 'c', basisPoints: 3333 },
      { membershipId: 'b', basisPoints: 3333 },
      { membershipId: 'a', basisPoints: 3334 },
    ]),
  ).toEqual([
    { membershipId: 'a', basisPoints: 3334, amountSatang: 3335n },
    { membershipId: 'b', basisPoints: 3333, amountSatang: 3333n },
    { membershipId: 'c', basisPoints: 3333, amountSatang: 3333n },
  ]);
  expect(
    allocateShares(1, [
      { membershipId: 'b', basisPoints: 5000 },
      { membershipId: 'a', basisPoints: 5000 },
    ])[0]?.amountSatang,
  ).toBe(1n);
});
test('rejects invalid basis point sums, duplicate members and unsafe money', () => {
  for (const bps of [9999, 10001])
    expect(() => allocateShares(20000, [{ membershipId: 'a', basisPoints: bps }])).toThrow();
  expect(() =>
    allocateShares(20000, [
      { membershipId: 'a', basisPoints: 5000 },
      { membershipId: 'a', basisPoints: 5000 },
    ]),
  ).toThrow();
  for (const amount of [0, 1.5, 900000000001, Number.MAX_SAFE_INTEGER])
    expect(() => allocateShares(amount, [{ membershipId: 'a', basisPoints: 10000 }])).toThrow();
  expect(
    allocateShares(900000000000, [
      { membershipId: 'a', basisPoints: 3334 },
      { membershipId: 'b', basisPoints: 3333 },
      { membershipId: 'c', basisPoints: 3333 },
    ]).reduce((n, s) => n + s.amountSatang, 0n),
  ).toBe(900000000000n);
});
