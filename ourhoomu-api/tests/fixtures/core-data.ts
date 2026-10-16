import type { HttpTransaction } from '../../src/modules/core/data';

const unused = async (): Promise<never> => {
  throw new Error('Unexpected synthetic transaction method');
};
export function transactionFixture(overrides: Partial<HttpTransaction>): HttpTransaction {
  return {
    targetMembership: unused,
    command: unused,
    me: unused,
    houses: unused,
    house: unused,
    ownMembership: unused,
    members: unused,
    accounts: unused,
    account: unused,
    accountSecret: unused,
    invitation: unused,
    ...overrides,
  };
}
