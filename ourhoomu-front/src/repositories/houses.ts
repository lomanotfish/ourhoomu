import type { ApiClient, ApiRequestOptions } from '../api/client';
import type { operations } from '../api/dto';
import type {
  AccountInput,
  AccountPatch,
  HouseCreate,
  HousePatch,
  InvitationAccept,
  InvitationCreate,
  ListQuery,
  MutationOptions,
  RequestOptions,
} from './contracts';

type HouseOperation =
  | 'listHouses'
  | 'createHouse'
  | 'getHouse'
  | 'patchHouse'
  | 'listMembers'
  | 'createInvitation'
  | 'acceptInvitation'
  | 'revokeInvitation'
  | 'leaveHouse'
  | 'removeMember'
  | 'listOwnAccounts'
  | 'createOwnAccount'
  | 'patchOwnAccount';
type Envelope<TOperation extends HouseOperation> =
  operations[TOperation]['responses'][200]['content']['application/json'];
type Data<TOperation extends HouseOperation> = Envelope<TOperation>['data'];

function encodedId(value: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new TypeError('Expected a UUID');
  }
  return encodeURIComponent(value);
}

function listPath(path: string, query: ListQuery): string {
  const params = new URLSearchParams();
  if (query.cursor !== undefined) {
    if (
      typeof query.cursor !== 'string' ||
      query.cursor.length === 0 ||
      /[\u0000-\u001f\u007f]/.test(query.cursor)
    ) {
      throw new TypeError('Expected a nonempty opaque cursor without control characters');
    }
    // encodeURIComponent rejects unpaired surrogates instead of silently changing the cursor.
    try {
      encodeURIComponent(query.cursor);
    } catch {
      throw new TypeError('Invalid cursor encoding');
    }
    params.set('cursor', query.cursor);
  }
  if (query.limit !== undefined) {
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100) {
      throw new TypeError('Expected a list limit between 1 and 100');
    }
    params.set('limit', String(query.limit));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

function mutationOptions(
  options: MutationOptions,
  method: string,
  body?: ApiRequestOptions['body'],
): ApiRequestOptions {
  encodedId(options.idempotencyKey);
  return { method, body, idempotencyKey: options.idempotencyKey, signal: options.signal };
}

function validateVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1)
    throw new TypeError('Expected a positive integer version');
}

/** Stateless adapter: returns ApiClient's data projection, with no caching or conflict replay. */
export function createHouseRepository(client: ApiClient) {
  const housePath = (houseId: string) => `/v1/houses/${encodedId(houseId)}`;
  return {
    async list(
      query: ListQuery = {},
      options: RequestOptions = {},
    ): Promise<Envelope<'listHouses'>> {
      return client.requestPage(listPath('/v1/houses', query), { signal: options.signal });
    },
    async create(body: HouseCreate, options: MutationOptions): Promise<Data<'createHouse'>> {
      return client.request('/v1/houses', mutationOptions(options, 'POST', body));
    },
    async detail(houseId: string, options: RequestOptions = {}): Promise<Data<'getHouse'>> {
      return client.request(housePath(houseId), { signal: options.signal });
    },
    async rename(
      houseId: string,
      body: HousePatch,
      options: MutationOptions,
    ): Promise<Data<'patchHouse'>> {
      validateVersion(body.expectedVersion);
      return client.request(housePath(houseId), mutationOptions(options, 'PATCH', body));
    },
    async members(
      houseId: string,
      query: ListQuery = {},
      options: RequestOptions = {},
    ): Promise<Envelope<'listMembers'>> {
      return client.requestPage(listPath(`${housePath(houseId)}/members`, query), {
        signal: options.signal,
      });
    },
    async issueInvitation(
      houseId: string,
      body: InvitationCreate,
      options: MutationOptions,
    ): Promise<Data<'createInvitation'>> {
      return client.request(
        `${housePath(houseId)}/invitations`,
        mutationOptions(options, 'POST', body),
      );
    },
    async acceptInvitation(
      body: InvitationAccept,
      options: MutationOptions,
    ): Promise<Data<'acceptInvitation'>> {
      return client.request('/v1/invitations/accept', mutationOptions(options, 'POST', body));
    },
    async revokeInvitation(
      houseId: string,
      invitationId: string,
      options: MutationOptions,
    ): Promise<Data<'revokeInvitation'>> {
      return client.request(
        `${housePath(houseId)}/invitations/${encodedId(invitationId)}`,
        mutationOptions(options, 'DELETE'),
      );
    },
    async leave(houseId: string, options: MutationOptions): Promise<Data<'leaveHouse'>> {
      return client.request(`${housePath(houseId)}/leave`, mutationOptions(options, 'POST'));
    },
    async removeMember(
      houseId: string,
      membershipId: string,
      options: MutationOptions,
    ): Promise<Data<'removeMember'>> {
      return client.request(
        `${housePath(houseId)}/members/${encodedId(membershipId)}`,
        mutationOptions(options, 'DELETE'),
      );
    },
    async listOwnAccounts(
      query: ListQuery = {},
      options: RequestOptions = {},
    ): Promise<Envelope<'listOwnAccounts'>> {
      return client.requestPage(listPath('/v1/me/recipient-accounts', query), {
        signal: options.signal,
      });
    },
    async createOwnAccount(
      body: AccountInput,
      options: MutationOptions,
    ): Promise<Data<'createOwnAccount'>> {
      return client.request('/v1/me/recipient-accounts', mutationOptions(options, 'POST', body));
    },
    async patchOwnAccount(
      accountId: string,
      body: AccountPatch,
      options: MutationOptions,
    ): Promise<Data<'patchOwnAccount'>> {
      validateVersion(body.expectedVersion);
      return client.request(
        `/v1/me/recipient-accounts/${encodedId(accountId)}`,
        mutationOptions(options, 'PATCH', body),
      );
    },
  };
}
