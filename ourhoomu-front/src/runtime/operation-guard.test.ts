import { describe, expect, test } from 'bun:test';
import { createOperationGuard } from './operation-guard';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function expectSelectionRequests({
  selected,
  requests,
  expectedHouse,
}: {
  selected: string | null;
  requests: string[];
  expectedHouse: string;
}) {
  let generation = 0;
  let authGeneration = 1;
  let activeHouse: string | null = selected;
  let busy = false;
  const pending: Array<{ house: string; response: ReturnType<typeof deferred<string>> }> = [];

  const loadHouseDetail = (house: string) => {
    const requestGeneration = ++generation;
    const guard = createOperationGuard({
      generation: requestGeneration,
      liveGeneration: () => generation,
      authGeneration,
      liveAuthGeneration: () => authGeneration,
    });
    busy = true;
    const response = deferred<string>();
    pending.push({ house, response });
    return response.promise.then((detail) => {
      if (!guard.current()) return;
      activeHouse = detail;
      busy = false;
    });
  };

  const completions = requests.map((house) => loadHouseDetail(house));
  for (const request of pending) request.response.resolve(request.house);
  await Promise.all(completions);

  expect(activeHouse).toBe(expectedHouse);
  expect(busy).toBe(false);
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

  test('selection detail commits when no house was active at request start', async () => {
    await expectSelectionRequests({
      selected: null,
      requests: ['house-b'],
      expectedHouse: 'house-b',
    });
  });

  test('selection detail commits B after selecting from active house A', async () => {
    await expectSelectionRequests({
      selected: 'house-a',
      requests: ['house-b'],
      expectedHouse: 'house-b',
    });
  });

  test('rapid B then C selection only commits C', async () => {
    await expectSelectionRequests({
      selected: null,
      requests: ['house-b', 'house-c'],
      expectedHouse: 'house-c',
    });
  });

  test('logout while selection is pending prevents data updates and its finally skips busy reset', async () => {
    const request = deferred<string>();
    let generation = 1;
    let authGeneration = 2;
    let busy = true;
    let activeHouse: string | null = null;
    const guard = createOperationGuard({
      generation,
      liveGeneration: () => generation,
      authGeneration,
      liveAuthGeneration: () => authGeneration,
    });
    const completion = request.promise.then((house) => {
      if (!guard.current()) return;
      activeHouse = house;
      busy = false;
    });

    authGeneration++;
    generation++;
    request.resolve('house-b');
    await completion;

    expect(activeHouse).toBeNull();
    expect(busy).toBe(true);
  });

  test('house-scoped mutations still require the same active house', () => {
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
