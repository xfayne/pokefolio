import { create } from 'zustand';
import type { PurchaseDraft } from '@/domain/purchase-draft';

// Transient UI state only. Never persist collections, tokens or purchase history here.
type UIState = {
  searchQuery: string; setSearchQuery: (query: string) => void;
  purchaseDrafts: Partial<Record<string, PurchaseDraft>>;
  setPurchaseDraft: (mode: string, draft: PurchaseDraft | null) => void;
  reset: () => void;
};
export const useUIStore = create<UIState>((set) => ({
  searchQuery: '', setSearchQuery: (searchQuery) => set({ searchQuery }), purchaseDrafts: {},
  setPurchaseDraft: (mode, draft) => set(s => ({ purchaseDrafts: { ...s.purchaseDrafts, [mode]: draft ?? undefined } })),
  reset: () => set({ searchQuery: '', purchaseDrafts: {} }),
}));
