import type { operations, components } from '../api/dto';

export type House = components['schemas']['House'];
export type Member = components['schemas']['Member'];
export type OwnAccount = components['schemas']['AccountPrivate'];
export type InvitationIssued = components['schemas']['InvitationIssued'];
export type InvitationMetadata = components['schemas']['InvitationMetadata'];
export type HouseCreate = components['schemas']['HouseCreate'];
export type HousePatch = components['schemas']['HousePatch'];
export type InvitationCreate = components['schemas']['InvitationCreate'];
export type InvitationAccept = components['schemas']['InvitationAccept'];
export type AccountInput = components['schemas']['AccountInput'];
export type AccountPatch = components['schemas']['AccountPatch'];
export type ListQuery = NonNullable<operations['listHouses']['parameters']['query']>;
export type RequestOptions = { signal?: AbortSignal };
export type MutationOptions = RequestOptions & { idempotencyKey: string };
