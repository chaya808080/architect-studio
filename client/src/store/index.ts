import { configureStore, createSelector } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import data from './dataSlice';
import ui, { pushToast } from './uiSlice';
import type { Db } from '../domain/types';

export const store = configureStore({ reducer: { data, ui } });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

/** All tables as one object - the input of the smart engines (scoring, availability, insights, assistant). */
export const selectDb = createSelector(
  [(s: RootState) => s.data],
  (d): Db => ({
    clients: d.clients, projects: d.projects, tasks: d.tasks, budgetItems: d.budgetItems, payments: d.payments,
    meetings: d.meetings, workingHours: d.workingHours, inspirations: d.inspirations, approvals: d.approvals,
  }),
);

const byId = <T extends { id: number }>(rows: T[]) => new Map(rows.map(r => [r.id, r]));

/** Memoised lookup maps - every page joins tables through these. */
export const selectLookups = createSelector(
  [(s: RootState) => s.data.clients, (s: RootState) => s.data.projects],
  (clients, projects) => ({ client: byId(clients), project: byId(projects) }),
);

/**
 * Runs a thunk and reports the outcome as a toast. Returns true on success,
 * so forms can close only when the server (or demo rules) accepted the change.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncThunkLike = (dispatch: AppDispatch, getState: () => RootState, extra: unknown) => Promise<any>;

export function useAction() {
  const dispatch = useAppDispatch();
  return async (thunk: AsyncThunkLike, success?: string): Promise<boolean> => {
    const result = await dispatch(thunk);
    if (result?.error) {
      dispatch(pushToast('error', result.error.message ?? 'הפעולה נכשלה'));
      return false;
    }
    if (success) dispatch(pushToast('success', success));
    return true;
  };
}
