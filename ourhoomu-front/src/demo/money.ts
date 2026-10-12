import type { Bill, Share } from './types';

export function parseSatang(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [baht, decimal = ''] = normalized.split('.');
  const satang = Number(baht) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(satang) && satang > 0 && satang <= 100_000_000_00 ? satang : null;
}

export function parseBps(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fractional = ''] = normalized.split('.');
  const bps = Number(whole) * 100 + Number(fractional.padEnd(2, '0'));
  return Number.isInteger(bps) && bps > 0 && bps <= 10000 ? bps : null;
}

export function equalBps(ids: string[]): Record<string, number> {
  const sorted = [...ids].sort();
  if (!sorted.length) return {};
  const each = Math.floor(10000 / sorted.length);
  const extra = 10000 - each * sorted.length;
  return Object.fromEntries(sorted.map((id, index) => [id, each + (index < extra ? 1 : 0)]));
}

export function allocateShares(totalSatang: number, bpsByMember: Record<string, number>): Share[] {
  const entries = Object.entries(bpsByMember);
  if (
    !Number.isSafeInteger(totalSatang) ||
    totalSatang <= 0 ||
    entries.length === 0 ||
    entries.some(([, bps]) => !Number.isInteger(bps) || bps <= 0) ||
    entries.reduce((sum, [, bps]) => sum + bps, 0) !== 10000
  )
    throw new Error('invalid_split');
  const ranked = entries.map(([memberId, bps]) => {
    const product = BigInt(totalSatang) * BigInt(bps);
    return {
      memberId,
      bps,
      amountSatang: Number(product / 10000n),
      remainder: Number(product % 10000n),
    };
  });
  let left = totalSatang - ranked.reduce((sum, item) => sum + item.amountSatang, 0);
  ranked.sort((a, b) => b.remainder - a.remainder || a.memberId.localeCompare(b.memberId));
  for (const item of ranked) if (left-- > 0) item.amountSatang++;
  return ranked
    .sort((a, b) => a.memberId.localeCompare(b.memberId))
    .map(({ memberId, bps, amountSatang }) => ({ memberId, bps, amountSatang }));
}

export function confirmedRemaining(bill: Bill, memberId: string): number {
  const share = bill.shares.find((item) => item.memberId === memberId);
  if (!share || bill.recipientId === memberId) return 0;
  return share.amountSatang; // Demo never confirms money; the API will own credits.
}

export function availableToRequest(bill: Bill, memberId: string): number {
  return Math.max(
    0,
    confirmedRemaining(bill, memberId) -
      bill.payments
        .filter((p) => p.payerId === memberId)
        .reduce((sum, p) => sum + p.amountSatang, 0),
  );
}

export function formatBaht(satang: number): string {
  return `฿${(satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
