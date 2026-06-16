import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Lead } from '@/types/company-manager/lead';

interface LeadsState {
  leads: Record<string, Lead[]>;
  isLoading: boolean;
  error: string | null;
  
  setLeads: (tab: string, leads: Lead[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useLeadsStore = create<LeadsState>()(
  devtools(
    (set) => ({
      leads: {},
      isLoading: false,
      error: null,

      setLeads: (tab: string, leads: Lead[]) => 
        set((state) => ({
          leads: { ...state.leads, [tab]: leads },
          isLoading: false
        })),

      setLoading: (isLoading: boolean) => set({ isLoading }),
      setError: (error: string | null) => set({ error, isLoading: false })
    }),
    { name: 'leads-store' }
  )
);
