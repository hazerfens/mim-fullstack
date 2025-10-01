import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User } from '@/types/user/user';

interface SessionState {
  user: User | null;
  isLoading: boolean;
  lastFetch: number | null;
  error: string | null;
}

interface SessionActions {
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  fetchUser: () => Promise<void>;
  clearSession: () => void;
  shouldRefetch: () => boolean;
}

export type SessionStore = SessionState & SessionActions;

const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 dakika

export const useSessionStore = create<SessionStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        user: null,
        isLoading: false,
        lastFetch: null,
        error: null,

        // Actions
        setUser: (user) => {
          set({ user, lastFetch: Date.now(), error: null }, false, 'setUser');
        },

        setLoading: (isLoading) => {
          set({ isLoading }, false, 'setLoading');
        },

        setError: (error) => {
          set({ error, isLoading: false }, false, 'setError');
        },

        fetchUser: async () => {
          const { isLoading, shouldRefetch } = get();

          // Eğer zaten yükleme yapılıyorsa veya yakın zamanda fetch edildiyse, tekrar fetch etme
          if (isLoading || !shouldRefetch()) {
            return;
          }

          set({ isLoading: true, error: null }, false, 'fetchUser:start');

          try {
            const response = await fetch('/api/auth/me', {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            });

            if (response.ok) {
              const userData = await response.json();
              set(
                { user: userData, lastFetch: Date.now(), isLoading: false, error: null },
                false,
                'fetchUser:success'
              );
            } else if (response.status === 401) {
              // Unauthorized - kullanıcı oturum açmamış
              set(
                { user: null, lastFetch: Date.now(), isLoading: false, error: null },
                false,
                'fetchUser:unauthorized'
              );
            } else {
              set(
                {
                  user: null,
                  isLoading: false,
                  error: 'Failed to fetch user',
                  lastFetch: Date.now(),
                },
                false,
                'fetchUser:error'
              );
            }
          } catch (error) {
            console.error('Session fetch failed:', error);
            set(
              {
                user: null,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                lastFetch: Date.now(),
              },
              false,
              'fetchUser:catch'
            );
          }
        },

        clearSession: () => {
          set(
            { user: null, isLoading: false, lastFetch: null, error: null },
            false,
            'clearSession'
          );
        },

        shouldRefetch: () => {
          const { lastFetch } = get();
          if (!lastFetch) return true;
          return Date.now() - lastFetch > REFETCH_INTERVAL;
        },
      }),
      {
        name: 'session-storage',
        partialize: (state) => ({
          user: state.user,
          lastFetch: state.lastFetch,
        }),
      }
    ),
    { name: 'SessionStore' }
  )
);

// Selector hooks for better performance
export const useUser = () => useSessionStore((state) => state.user);
export const useIsLoading = () => useSessionStore((state) => state.isLoading);
export const useSessionError = () => useSessionStore((state) => state.error);
