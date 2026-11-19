import { create } from 'zustand';

// Transient UI state only. Never persist collections, tokens or purchase history here.
type UIState = { searchQuery: string; setSearchQuery: (query: string) => void; reset: () => void };
export const useUIStore = create<UIState>((set) => ({ searchQuery: '', setSearchQuery: (searchQuery) => set({ searchQuery }), reset: () => set({ searchQuery: '' }) }));
