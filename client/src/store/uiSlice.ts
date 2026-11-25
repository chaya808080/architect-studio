import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type Theme = 'dark' | 'light';
export interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string }

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('atelier-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* ignore */ }
  return 'light';
}

let nextToast = 1;

const uiSlice = createSlice({
  name: 'ui',
  initialState: { theme: initialTheme(), toasts: [] as Toast[], paletteOpen: false, sidebarOpen: false },
  reducers: {
    toggleTheme: s => {
      s.theme = s.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('atelier-theme', s.theme); } catch { /* ignore */ }
    },
    pushToast: {
      reducer: (s, a: PayloadAction<Toast>) => { s.toasts.push(a.payload); },
      prepare: (kind: Toast['kind'], message: string) => ({ payload: { id: nextToast++, kind, message } }),
    },
    dismissToast: (s, a: PayloadAction<number>) => { s.toasts = s.toasts.filter(t => t.id !== a.payload); },
    setPalette: (s, a: PayloadAction<boolean>) => { s.paletteOpen = a.payload; },
    setSidebar: (s, a: PayloadAction<boolean>) => { s.sidebarOpen = a.payload; },
  },
});

export const { toggleTheme, pushToast, dismissToast, setPalette, setSidebar } = uiSlice.actions;
export default uiSlice.reducer;
