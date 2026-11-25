import type { EntityMap, ResourceName } from '../domain/types';

export interface Resource<T extends { id: number }> {
  list(): Promise<T[]>;
  create(item: Omit<T, 'id'>): Promise<T>;
  update(item: T): Promise<T>;
  remove(id: number): Promise<void>;
}

export type Resources = { [K in ResourceName]: Resource<EntityMap[K]> };

export interface SignInput { projectId: number; fee: number; startDate: string; dueDate: string; plan: { label: string; percent: number }[] }

/** One contract, two implementations: the .NET Web API (httpApi) and the in-browser demo (demoApi). */
export interface StudioApi {
  mode: 'server' | 'demo';
  resources: Resources;
  /** Signs a proposal: updates fee & dates, moves the project to 'נחתם' and creates the payment plan - atomically. */
  signProposal(input: SignInput): Promise<void>;
  resetDemo?(): void;
}

/** Error carrying the Hebrew business-rule message to the UI. */
export class ApiError extends Error {}
