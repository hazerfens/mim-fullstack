import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  getUserCompaniesAction,
  getActiveCompanyAction,
  switchCompanyAction,
} from "@/features/actions/company-action";

export interface Company {
  id: string;
  name: string;
  unvani?: string;
  url?: string;
  vn?: string;
  vd?: string;
  mersis?: string;
  oda?: string;
  odano?: string;
  phone?: string;
  cellphone?: string;
  email?: string;
  logo?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  workinghours?: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
  modules?: {
    crm: boolean;
    hr: boolean;
    finance: boolean;
    inventory: boolean;
    marketing: boolean;
    sales: boolean;
    support: boolean;
  };
}

interface CompanyState {
  companies: Company[];
  activeCompany: Company | null;
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  fetchCompanies: () => Promise<void>;
  fetchActiveCompany: (force?: boolean) => Promise<void>;
  switchCompany: (companyId: string) => Promise<{ ok: boolean; message?: string; statusCode?: number }>;
  clearCompanies: () => void;
  setInitialized: (v: boolean) => void;
  hydrateCompanies: (companies: Company[], active?: Company | null) => void;
}
let lastFetchActiveAttempt = 0;
let lastFetchCompaniesAttempt = 0;

export const useCompanyStore = create<CompanyState>()(
  persist(
  (set, get) => ({
  companies: [],
  activeCompany: null,
  initialized: false,
      isLoading: false,
      error: null,

      fetchCompanies: async (force: boolean = false) => {
        // If we already have companies and caller doesn't force, skip network call
        const state = get();
        if (!force && state.companies && state.companies.length > 0) return;
        // Throttle rapid repeated attempts
        const now = Date.now();
        if (!force && now - lastFetchCompaniesAttempt < 1000) return;
        lastFetchCompaniesAttempt = now;
        set({ isLoading: true, error: null });
        try {
          const result = await getUserCompaniesAction();

          if (result.status === "success" && result.data) {
            set({
              companies: result.data,
              isLoading: false,
              error: null,
            });
          } else {
            set({
              error: result.message || "Failed to fetch companies",
              isLoading: false,
            });
          }
        } catch (error) {
          console.error("Error fetching companies:", error);
          set({
            error: "An unexpected error occurred",
            isLoading: false,
          });
        }
      },

      hydrateCompanies: (companies: Company[], active: Company | null = null) => {
        set({ companies, activeCompany: active, initialized: true, isLoading: false, error: null });
      },

  fetchActiveCompany: async (force = false) => {
        const state = get();
        // Throttle rapid fetch attempts to avoid multiple simultaneous calls
        const now = Date.now();
        if (!force && now - lastFetchActiveAttempt < 1000) return;
        lastFetchActiveAttempt = now;
        // If already initialized and not forcing, skip network call to avoid repeated
        // requests on route changes or refreshes.
        if (state.initialized && !force) return;

        set({ isLoading: true, error: null });
        try {
          const result = await getActiveCompanyAction();

          if (result.status === "success" && result.data) {
            set({
              activeCompany: result.data,
              isLoading: false,
              error: null,
            });
          } else {
            set({
              activeCompany: null,
              error: result.message || "Failed to fetch active company",
              isLoading: false,
            });
          }
        } catch (error) {
          console.error("Error fetching active company:", error);
          set({
            error: "An unexpected error occurred",
            isLoading: false,
          });
        } finally {
          // Mark store as initialized so subsequent route changes won't refetch
          set({ initialized: true });
        }
      },

      switchCompany: async (companyId: string) => {
        set({ isLoading: true, error: null });
        // Optimistic update: clear previous selection and assign the new company info immediately
        const prev = (get() as CompanyState).activeCompany;
        const companies = (get() as CompanyState).companies;
        const target = companies.find((c) => c.id === companyId) || { id: companyId } as Company;
        set({ activeCompany: target });

        try {
          const result = await switchCompanyAction(companyId);

            if (result.status === 'success') {
              // Keep optimistic activeCompany and persist to localStorage so
              // future client loads don't need to re-query the server for
              // the active company. This avoids an extra GET /company/active
              // roundtrip after switching.
              try {
                if (typeof window !== 'undefined' && window.localStorage) {
                  const existingRaw = window.localStorage.getItem('company-storage');
                  let obj: { companies?: Company[]; activeCompany?: Company | null } = {};
                  if (existingRaw) {
                    try { obj = JSON.parse(existingRaw) || {}; } catch {}
                  }
                  obj.activeCompany = target;
                  // Also ensure companies list contains the target
                  obj.companies = Array.isArray(obj.companies) ? obj.companies : (companies || []);
                  const already = obj.companies.find((c) => c.id === target.id);
                  if (!already) obj.companies.push(target);
                  window.localStorage.setItem('company-storage', JSON.stringify(obj));
                }
              } catch (e) {
                try { console.warn('[company-store] failed to persist activeCompany', e); } catch {}
              }
              set({ isLoading: false, error: null });
              return { ok: true };
          }

          // On failure: revert to previous active company and set error
          set({
            activeCompany: prev || null,
            error: result.message || 'Failed to switch company',
            isLoading: false,
          });
          return { ok: false, message: result.message, statusCode: result.statusCode };
        } catch (error) {
          console.error('Error switching company:', error);
          // Revert optimistic update on error
          set({
            activeCompany: prev || null,
            error: 'An unexpected error occurred',
            isLoading: false,
          });
          return { ok: false, message: 'An unexpected error occurred', statusCode: 500 };
        }
      },

      clearCompanies: () => {
        // Avoid no-op updates which can trigger unnecessary re-renders
        const s = get();
        if ((s.companies == null || s.companies.length === 0) && s.activeCompany == null) return;
        set({
          companies: [],
          activeCompany: null,
          isLoading: false,
          error: null,
        });
      },
      setInitialized: (v: boolean) => set({ initialized: v }),
    }),
    {
      name: "company-storage",
      partialize: (state) => ({
        activeCompany: state.activeCompany,
      }),
    }
  )
);
