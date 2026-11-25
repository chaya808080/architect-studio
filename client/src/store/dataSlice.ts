import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { api } from '../api';
import type { Resource, SignInput } from '../api/api';
import type { EntityMap, ResourceName } from '../domain/types';

type Tables = { [K in ResourceName]: EntityMap[K][] };

interface DataState extends Tables {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  saving: boolean;
}

const RESOURCES: ResourceName[] = [
  'clients', 'projects', 'tasks', 'budgetItems', 'payments', 'meetings', 'workingHours', 'inspirations', 'approvals',
];

const empty = Object.fromEntries(RESOURCES.map(r => [r, []])) as unknown as Tables;
const initialState: DataState = { ...empty, status: 'idle', error: null, saving: false };

/** Loads every table in parallel. */
export const loadAll = createAsyncThunk('data/loadAll', async () => {
  const lists = await Promise.all(RESOURCES.map(r => api.resources[r].list()));
  return Object.fromEntries(RESOURCES.map((r, i) => [r, lists[i]])) as unknown as Tables;
});

type AnyResource = Resource<{ id: number }>;
const res = (r: ResourceName) => api.resources[r] as unknown as AnyResource;

const createItem = createAsyncThunk('data/create', async ({ resource, item }: { resource: ResourceName; item: object }) =>
  ({ resource, item: await res(resource).create(item as never) }));

const updateItem = createAsyncThunk('data/update', async ({ resource, item }: { resource: ResourceName; item: { id: number } }) =>
  ({ resource, item: await res(resource).update(item) }));

const removeItem = createAsyncThunk('data/remove', async ({ resource, id }: { resource: ResourceName; id: number }, { dispatch }) => {
  await res(resource).remove(id);
  if (resource === 'projects') void dispatch(loadAll()); // cascade: tasks, budget, payments, approvals
  return { resource, id };
});

/** Typed entry points - the resource name decides the item type. */
export const create = <K extends ResourceName>(resource: K, item: Omit<EntityMap[K], 'id'>) => createItem({ resource, item });
export const update = <K extends ResourceName>(resource: K, item: EntityMap[K]) => updateItem({ resource, item });
export const remove = (resource: ResourceName, id: number) => removeItem({ resource, id });

/** Signing touches the project and its payment plan, so both are re-read from the source of truth. */
export const signProposal = createAsyncThunk('data/sign', async (input: SignInput) => {
  await api.signProposal(input);
  const [projects, payments] = await Promise.all([api.resources.projects.list(), api.resources.payments.list()]);
  return { projects, payments };
});

type Row = { id: number };
const table = (state: DataState, r: ResourceName) => state[r] as Row[];

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    replaceAll: (state, action: PayloadAction<Tables>) => ({ ...state, ...action.payload }),
  },
  extraReducers: b => {
    b.addCase(loadAll.pending, s => { s.status = 'loading'; s.error = null; })
      .addCase(loadAll.fulfilled, (s, a) => ({ ...s, ...a.payload, status: 'ready' as const }))
      .addCase(loadAll.rejected, (s, a) => { s.status = 'error'; s.error = a.error.message ?? 'שגיאה בטעינה'; })
      .addCase(createItem.fulfilled, (s, a) => { table(s, a.payload.resource).push(a.payload.item as Row); })
      .addCase(updateItem.fulfilled, (s, a) => {
        const rows = table(s, a.payload.resource);
        const i = rows.findIndex(x => x.id === (a.payload.item as Row).id);
        if (i >= 0) rows[i] = a.payload.item as Row;
      })
      .addCase(removeItem.fulfilled, (s, a) => {
        const rows = table(s, a.payload.resource);
        const i = rows.findIndex(x => x.id === a.payload.id);
        if (i >= 0) rows.splice(i, 1);
      })
      .addCase(signProposal.fulfilled, (s, a) => ({ ...s, ...a.payload }))
      .addMatcher(a => a.type.startsWith('data/') && a.type.endsWith('/pending') && !a.type.startsWith('data/loadAll'), s => { s.saving = true; })
      .addMatcher(a => a.type.startsWith('data/') && (a.type.endsWith('/fulfilled') || a.type.endsWith('/rejected')), s => { s.saving = false; });
  },
});

export const { replaceAll } = dataSlice.actions;
export default dataSlice.reducer;
