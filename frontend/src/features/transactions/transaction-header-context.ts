import { createContext } from 'react';
export const TransactionHeaderContext = createContext<{ actions: HTMLElement | null; tabs: HTMLElement | null }>({ actions: null, tabs: null });
