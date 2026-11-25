import { createDemoApi } from './demoApi';
import { createHttpApi } from './httpApi';

/** VITE_API_URL=https://localhost:7110/api connects to the .NET server; without it the app runs in demo mode. */
const url = import.meta.env.VITE_API_URL as string | undefined;

export const api = url ? createHttpApi(url) : createDemoApi();
export { ApiError } from './api';
