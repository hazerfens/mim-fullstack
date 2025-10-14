import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { type Role, getRolesAction } from '@/features/actions/settings/roles/role-actions';

interface RolesState {
  roles: Role[];
  isLoading: boolean;
  lastFetch: number | null;
  error: string | null;
}

interface RolesActions {
  setRoles: (roles: Role[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  fetchRoles: (companyId?: string, force?: boolean) => Promise<void>;
  clearRoles: () => void;
  shouldRefetch: () => boolean;
}

export type RolesStore = RolesState & RolesActions;

const REFETCH_INTERVAL = 2 * 60 * 1000; // 2 dakika (roles daha az değişir)

// Client-side API URL for fallback fetches when server actions fail unexpectedly.
const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3333/api/v1';

export async function fetchRolesClient(companyId?: string) {
  try {
    const url = companyId ? `${API_URL}/roles?company_id=${encodeURIComponent(companyId)}` : `${API_URL}/roles/system`;
    const res = await fetch(url, { method: 'GET', credentials: 'include' });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const j = await res.json().catch(() => null);
        if (j && j.message) message = j.message;
      } catch {}
      return { status: 'error', message };
    }
    const data = await res.json().catch(() => null);
    return { status: 'success', roles: (data && data.roles) || [] };
  } catch (err: any) {
    console.error('fetchRolesClient error:', err);
    return { status: 'error', message: err instanceof Error ? err.message : 'Network error' };
  }
}

// Track in-flight fetch promises per companyId to coalesce concurrent requests
const inFlightFetches = new Map<string, Promise<void>>();

export const useRolesStore = create<RolesStore>()(
  devtools(
    (set, get) => ({
      // State
      roles: [],
      isLoading: false,
      lastFetch: null,
      error: null,

      // Actions
      setRoles: (roles) => {
        set({ roles, lastFetch: Date.now(), error: null }, false, 'setRoles');
      },

      setLoading: (isLoading) => {
        set({ isLoading }, false, 'setLoading');
      },

      setError: (error) => {
        set({ error, isLoading: false }, false, 'setError');
      },

      fetchRoles: async (companyId?: string, force: boolean = false) => {
        const { isLoading, shouldRefetch } = get();

        // If not forced and cache is fresh, skip — but if we have no roles cached
        // we should still attempt a fetch even if the cache timestamp is recent.
        const currentRoles = get().roles || []
        if (!force && (isLoading || (!shouldRefetch() && currentRoles.length > 0))) {
          console.log('⏭️ Skipping roles fetch - cache is fresh');
          return;
        }

        const key = companyId || '__SYSTEM__';

        // If a fetch for the same key is already in-flight, await it instead of
        // starting a new request. This coalesces concurrent callers.
        if (inFlightFetches.has(key)) {
          console.log('⏳ Awaiting existing roles fetch for', key);
          return inFlightFetches.get(key);
        }

        // Create the fetch promise and register it in the map so other callers
        // can await it.
        const fetchPromise = (async () => {
          set({ isLoading: true, error: null }, false, 'fetchRoles:start');
          try {
            // Prefer server action since it runs with access to server-side cookies
            // and may perform additional normalization. If it throws or returns an
            // error we fall back to a client-side fetch which uses browser cookies.
            let result: any = null
            try {
              result = await getRolesAction(companyId)
            } catch (err) {
              console.warn('getRolesAction threw; attempting client-side fetch fallback', err)
              result = await fetchRolesClient(companyId)
            }

            if (result.status === 'success') {
              const fetched = (result.roles || []).filter((r: Role) => r.is_active === true)

              // De-duplicate roles by name and prefer company-scoped role when applicable.
              const dedupedMap = new Map<string, Role>()
              for (const role of fetched) {
                const keyName = role.name
                const existing = dedupedMap.get(keyName)
                if (!existing) {
                  dedupedMap.set(keyName, role)
                  continue
                }
                const existingCompany = existing.company_id || null
                const currentCompany = role.company_id || null
                if (companyId && currentCompany === companyId) {
                  dedupedMap.set(keyName, role)
                } else if (!existingCompany && currentCompany) {
                  dedupedMap.set(keyName, role)
                }
              }

              const activeRoles = Array.from(dedupedMap.values())
              set({ roles: activeRoles, lastFetch: Date.now(), isLoading: false, error: null }, false, 'fetchRoles:success');
            } else {
              // If server action returned an error, attempt a client-side fetch
              console.warn('getRolesAction returned error, trying client-side fetch fallback:', result.message)
              const clientResult = await fetchRolesClient(companyId)
              if (clientResult.status === 'success') {
                const fetched = (clientResult.roles || []).filter((r: Role) => r.is_active === true)

                // De-duplicate roles by name and prefer company-scoped role when applicable.
                const dedupedMap = new Map<string, Role>()
                for (const role of fetched) {
                  const keyName = role.name
                  const existing = dedupedMap.get(keyName)
                  if (!existing) {
                    dedupedMap.set(keyName, role)
                    continue
                  }
                  const existingCompany = existing.company_id || null
                  const currentCompany = role.company_id || null
                  if (companyId && currentCompany === companyId) {
                    dedupedMap.set(keyName, role)
                  } else if (!existingCompany && currentCompany) {
                    dedupedMap.set(keyName, role)
                  }
                }

                const activeRoles = Array.from(dedupedMap.values())
                set({ roles: activeRoles, lastFetch: Date.now(), isLoading: false, error: null }, false, 'fetchRoles:success:clientFallback');
              } else {
                // Do not mark lastFetch on error so callers can retry sooner.
                set({ roles: [], isLoading: false, error: result.message || clientResult.message || 'Failed to fetch roles' }, false, 'fetchRoles:error');
              }
            }
          } catch (error) {
            console.error('Roles fetch failed:', error);
            // On unexpected errors we clear loading/error state but do not mark
            // lastFetch so subsequent callers can attempt another fetch.
            set({ roles: [], isLoading: false, error: error instanceof Error ? error.message : 'Unknown error' }, false, 'fetchRoles:catch');
          } finally {
            inFlightFetches.delete(key);
          }
        })();

        inFlightFetches.set(key, fetchPromise);
        return fetchPromise;
      },

      clearRoles: () => {
        set(
          { roles: [], isLoading: false, lastFetch: null, error: null },
          false,
          'clearRoles'
        );
      },

      shouldRefetch: () => {
        const { lastFetch } = get();
        if (!lastFetch) return true;
        const shouldRefetch = Date.now() - lastFetch > REFETCH_INTERVAL;
        console.log(`🔍 Roles cache check: ${shouldRefetch ? 'STALE' : 'FRESH'} (age: ${Math.round((Date.now() - lastFetch) / 1000)}s)`);
        return shouldRefetch;
      },
    }),
    { name: 'RolesStore' }
  )
);

// Selector hooks for better performance
export const useRoles = () => useRolesStore((state) => state.roles);
export const useRolesLoading = () => useRolesStore((state) => state.isLoading);
export const useRolesError = () => useRolesStore((state) => state.error);
