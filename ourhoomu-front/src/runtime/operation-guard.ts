export type OperationGuard = {
  current: () => boolean;
};

export function createOperationGuard(options: {
  generation: number;
  liveGeneration: () => number;
  authGeneration: number;
  liveAuthGeneration: () => number;
  targetHouseId?: string;
  liveTargetHouseId?: () => string | null;
}): OperationGuard {
  return {
    current: () =>
      options.generation === options.liveGeneration() &&
      options.authGeneration === options.liveAuthGeneration() &&
      (options.targetHouseId === undefined ||
        options.targetHouseId === options.liveTargetHouseId?.()),
  };
}
