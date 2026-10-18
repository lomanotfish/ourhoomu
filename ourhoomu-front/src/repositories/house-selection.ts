import type { House } from './contracts';

export type HouseSelection =
  | { status: 'invitation_pending' }
  | { status: 'create_or_join' }
  | { status: 'enter'; house: House }
  | { status: 'choose'; houses: readonly House[] }
  | { status: 'recovery_required'; unavailableHouseId: string; houses: readonly House[] };

/** Call only with the complete, current authorized house list, after loading succeeds. */
export function selectHouse(input: {
  houses: readonly House[];
  persistedHouseId?: string | null;
  pendingInvitation?: boolean;
}): HouseSelection {
  const { houses, persistedHouseId, pendingInvitation } = input;
  if (pendingInvitation) return { status: 'invitation_pending' };
  if (persistedHouseId !== undefined && persistedHouseId !== null) {
    const house = houses.find((candidate) => candidate.id === persistedHouseId);
    return house
      ? { status: 'enter', house }
      : { status: 'recovery_required', unavailableHouseId: persistedHouseId, houses };
  }
  if (houses.length === 0) return { status: 'create_or_join' };
  if (houses.length === 1) return { status: 'enter', house: houses[0]! };
  return { status: 'choose', houses };
}
