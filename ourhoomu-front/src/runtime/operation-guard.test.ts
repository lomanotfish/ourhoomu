import { describe, expect, test } from 'bun:test';
import { createOperationGuard } from './operation-guard';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('createOperationGuard', () => {
  test('rejects deferred fulfillment after auth or request generation changes', async () => {
    let generation = 4;
    let authGeneration = 8;
    const result = deferred<string>();
    const guard = createOperationGuard({
      generation,
      liveGeneration: () => generation,
      authGeneration,
      liveAuthGeneration: () => authGeneration,
    });
    const completion = result.promise.then((value) => (guard.current() ? value : null));

    authGeneration++;
    result.resolve('old identity data');
    expect(await completion).toBeNull();

    authGeneration--;
    const next = createOperationGuard({
      generation,
      liveGeneration: () => generation,
      authGeneration,
      liveAuthGeneration: () => authGeneration,
    });
    const secondResult = deferred<string>();
    const secondCompletion = secondResult.promise.then((value) => (next.current() ? value : null));
    generation++;
    secondResult.resolve('superseded request data');
    expect(await secondCompletion).toBeNull();
  });

  test('requires the same house for house-scoped completion', () => {
    let activeHouseId: string | null = 'house-a';
    const guard = createOperationGuard({
      generation: 1,
      liveGeneration: () => 1,
      authGeneration: 2,
      liveAuthGeneration: () => 2,
      targetHouseId: 'house-a',
      liveTargetHouseId: () => activeHouseId,
    });

    expect(guard.current()).toBe(true);
    activeHouseId = 'house-b';
    expect(guard.current()).toBe(false);
    activeHouseId = null;
    expect(guard.current()).toBe(false);
  });

  test('does not require a house for account/session operations', () => {
    const guard = createOperationGuard({
      generation: 3,
      liveGeneration: () => 3,
      authGeneration: 5,
      liveAuthGeneration: () => 5,
    });
    expect(guard.current()).toBe(true);
  });
});
