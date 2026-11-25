// Implementation of the API contract over the ASP.NET Core Web API (see /server).
// The server exposes the same entity shapes, so no mapping layer is needed.
import axios, { AxiosError } from 'axios';
import type { EntityMap, ResourceName } from '../domain/types';
import { ApiError, type Resource, type Resources, type StudioApi } from './api';

const ROUTES: Record<ResourceName, string> = {
  clients: 'clients', projects: 'projects', tasks: 'tasks', budgetItems: 'budget-items', payments: 'payments',
  meetings: 'meetings', workingHours: 'working-hours', inspirations: 'inspirations', approvals: 'approvals',
};

export function createHttpApi(baseURL: string): StudioApi {
  const http = axios.create({ baseURL, timeout: 15_000 });
  // ProblemDetails.title carries the Hebrew business-rule message from the BL layer
  http.interceptors.response.use(undefined, (error: AxiosError<{ title?: string }>) =>
    Promise.reject(new ApiError(error.response?.data?.title ?? (error.response ? `שגיאת שרת (${error.response.status})` : 'אין חיבור לשרת'))));

  function resource<K extends ResourceName>(name: K): Resource<EntityMap[K]> {
    const url = ROUTES[name];
    return {
      list: async () => (await http.get<EntityMap[K][]>(url)).data,
      create: async item => (await http.post<EntityMap[K]>(url, { ...item, id: 0 })).data,
      update: async item => (await http.put<EntityMap[K]>(`${url}/${item.id}`, item)).data,
      remove: async id => { await http.delete(`${url}/${id}`); },
    };
  }

  return {
    mode: 'server',
    resources: Object.fromEntries((Object.keys(ROUTES) as ResourceName[]).map(n => [n, resource(n)])) as unknown as Resources,
    signProposal: async input => { await http.post(`projects/${input.projectId}/sign`, input); },
  };
}
