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
  fetchRoles: () => Promise<void>;
  clearRoles: () => void;
  shouldRefetch: () => boolean;
}

export type RolesStore = RolesState & RolesActions;

const REFETCH_INTERVAL = 2 * 60 * 1000; // 2 dakika (roles daha az değişir)

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

      fetchRoles: async () => {
        const { isLoading, shouldRefetch } = get();

        // Eğer zaten yükleme yapılıyorsa veya yakın zamanda fetch edildiyse, tekrar fetch etme
        if (isLoading || !shouldRefetch()) {
          console.log('⏭️ Skipping roles fetch - cache is fresh');
          return;
        }

        set({ isLoading: true, error: null }, false, 'fetchRoles:start');

        try {
          const result = await getRolesAction();

          if (result.status === 'success') {
            set(
              { roles: result.roles, lastFetch: Date.now(), isLoading: false, error: null },
              false,
              'fetchRoles:success'
            );
          } else {
            set(
              {
                roles: [],
                isLoading: false,
                error: result.message || 'Failed to fetch roles',
                lastFetch: Date.now(),
              },
              false,
              'fetchRoles:error'
            );
          }
        } catch (error) {
          console.error('Roles fetch failed:', error);
          set(
            {
              roles: [],
              isLoading: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              lastFetch: Date.now(),
            },
            false,
            'fetchRoles:catch'
          );
        }
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
