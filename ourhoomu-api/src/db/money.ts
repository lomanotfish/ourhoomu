export const MAX_SATANG = 900_000_000_000;
export type Participant = Readonly<{ membershipId: string; basisPoints: number }>;

/** Exact integer allocation. SQL publish repeats this validation under its database locks. */
export function allocateShares(totalSatang: number, participants: readonly Participant[]) {
  if (!Number.isSafeInteger(totalSatang) || totalSatang < 1 || totalSatang > MAX_SATANG) {
    throw new Error('Invalid satang amount');
  }
  if (
    !participants.length ||
    new Set(participants.map((p) => p.membershipId)).size !== participants.length ||
    participants.some(
      (p) => !Number.isInteger(p.basisPoints) || p.basisPoints < 1 || p.basisPoints > 10000,
    ) ||
    participants.reduce((sum, p) => sum + p.basisPoints, 0) !== 10000
  )
    throw new Error('Invalid participants');
  const shares = participants.map((p) => ({
    ...p,
    amountSatang: (BigInt(totalSatang) * BigInt(p.basisPoints)) / 10000n,
    remainder: (BigInt(totalSatang) * BigInt(p.basisPoints)) % 10000n,
  }));
  shares.sort((a, b) =>
    a.remainder === b.remainder
      ? a.membershipId < b.membershipId
        ? -1
        : 1
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  const extra = BigInt(totalSatang) - shares.reduce((sum, p) => sum + p.amountSatang, 0n);
  for (let i = 0; BigInt(i) < extra; i++) {
    const share = shares[i];
    if (share) share.amountSatang += 1n;
  }
  return shares
    .sort((a, b) => (a.membershipId < b.membershipId ? -1 : 1))
    .map(({ remainder: _, ...share }) => share);
}
