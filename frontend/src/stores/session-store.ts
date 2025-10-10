import { create } from 'zustand';

// Module-scoped helpers (not persisted) to track in-flight fetch and attempts.
let currentFetchController: AbortController | null = null;
let sessionFetchAttempts = 0;
let lastFetchAttemptTs = 0;

// In-memory debug log buffer for session events (dev only)
const SESSION_LOG_LIMIT = 100;
const sessionLogs: string[] = [];
function pushSessionLog(entry: string) {
  const ts = new Date().toISOString();
  const msg = `${ts} ${entry}`;
  sessionLogs.push(msg);
  if (sessionLogs.length > SESSION_LOG_LIMIT) sessionLogs.shift();
  // Use warn so it's visible in console even if info is filtered
  try { console.warn('[session-store-log]', msg); } catch {}
}
export const getSessionLogs = () => [...sessionLogs];
export const getLastSessionFetchAttempt = () => lastFetchAttemptTs;

// Debug accessors (can be imported by dev-only UI)
export const getSessionFetchAttempts = () => sessionFetchAttempts;
export const isSessionFetchInFlight = () => Boolean(currentFetchController);
import { devtools, persist } from 'zustand/middleware';
import { getAccessToken } from '@/lib/auth-utils';
import { User } from '@/types/user/user';

interface SessionState {
  user: User | null;
  isLoading: boolean;
  lastFetch: number | null;
  error: string | null;
  isLoggedOut?: boolean;
}

interface SessionActions {
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  fetchUser: () => Promise<void>;
  clearSession: () => void;
    // Apply a login result (from server action) into the client store
    applyLoginResult: (user: User | null) => void;
    // Client-side logout helper that calls the internal API route and clears state
    logoutClient: () => Promise<{ status: string; message?: string; statusCode?: number }>;
  shouldRefetch: () => boolean;
  resetLoggedOut: () => void;
}

export type SessionStore = SessionState & SessionActions;

const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 dakika

export const useSessionStore = create<SessionStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Module-level helpers for aborting in-flight fetches and counting
        // attempts. These are not part of the persisted state.
        // ...existing code...
  // State
        user: null,
        isLoading: false,
        lastFetch: null,
        error: null,
  isLoggedOut: false,

        // Actions
        setUser: (user) => {
          // Debug log for observing when the session store is populated
          try {
            console.debug('[session-store] setUser', !!user, user ? { id: user.id, email: user.email } : null);
          } catch {}
          set({ user, lastFetch: Date.now(), error: null }, false, 'setUser');
        },

        setLoading: (isLoading) => {
          set({ isLoading }, false, 'setLoading');
        },

        setError: (error) => {
          set({ error, isLoading: false }, false, 'setError');
        },

        fetchUser: async () => {
          const { isLoading, shouldRefetch, isLoggedOut } = get();
          // Ensure we have a shared abort controller per in-flight request
          // and a counter for telemetry.
          // (module-scoped variables defined below)

          const now = Date.now();
          // Throttle rapid repeated attempts (e.g., many components triggering fetch at mount)
          if (now - lastFetchAttemptTs < 1000) {
            pushSessionLog('fetchUser suppressed due to throttle');
            return;
          }
          lastFetchAttemptTs = now;
          sessionFetchAttempts += 1;
          pushSessionLog(`fetchUser called (attempt #${sessionFetchAttempts})`);

          // If explicitly logged out, do not attempt network fetch
          if (isLoggedOut) return;

          // If already loading or not time to refetch, skip
          if (isLoading || !shouldRefetch()) {
            return;
          }

          pushSessionLog(`fetchUser:start lastFetch=${get().lastFetch}`);

          // Try to hydrate user from a client-side cookie-stored JWT when
          // available. This avoids an extra round-trip to /api/auth/me on
          // initial client-side navigations when we already have a valid
          // access token in cookies. If parsing fails or token is expired
          // fall back to normal network fetch below.
          try {
            const token = getAccessToken();
            if (token) {
              const claims = ((): Record<string, any> | null => {
                try {
                  const parts = token.split('.');
                  if (parts.length < 2) return null;
                  // base64url -> base64
                  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                  // atob is available in browsers; decode and parse JSON
                  const json = decodeURIComponent(
                    atob(b64)
                      .split('')
                      .map(function (c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                      })
                      .join('')
                  );
                  return JSON.parse(json);
                } catch (e) {
                  return null;
                }
              })();

              if (claims && (claims.sub || claims.id || claims.user_id) && claims.email) {
                const nowSec = Math.floor(Date.now() / 1000);
                const exp = typeof claims.exp === 'number' ? claims.exp : parseInt(claims.exp || '0', 10) || 0;
                // Only use cookie payload if token not expired (small leeway could be added)
                if (!exp || exp > nowSec) {
                  const userFromToken: any = {
                    id: claims.sub ?? claims.id ?? claims.user_id,
                    email: claims.email,
                    role: claims.role ?? claims.roles ?? claims['role'] ?? 'user',
                    full_name: claims.name ?? claims.full_name ?? null,
                    is_verified: typeof claims.is_verified === 'boolean' ? claims.is_verified : Boolean(claims.verified) || false,
                    iat: typeof claims.iat === 'number' ? claims.iat : undefined,
                    exp: exp || undefined,
                  };
                  pushSessionLog('fetchUser:hydrated-from-cookie');
                  set(
                    { user: userFromToken as any, lastFetch: Date.now(), isLoading: false, error: null },
                    false,
                    'fetchUser:from-cookie'
                  );
                  return;
                }
              }
            }
          } catch (e) {
            // If anything goes wrong parsing the token, fall back to network
            pushSessionLog('[fetchUser] cookie parse error');
          }

          set({ isLoading: true, error: null }, false, 'fetchUser:start');
          // create an AbortController for this request and keep reference
          try {
            currentFetchController?.abort();
          } catch {}
          currentFetchController = new AbortController();

          try {
            // Re-check logged out to avoid races where logout happened just before
            // the network call starts.
            if (get().isLoggedOut) {
              pushSessionLog('fetchUser aborted: isLoggedOut before network');
              set({ isLoading: false }, false, 'fetchUser:aborted-logged-out');
              return;
            }

            const response = await fetch('/api/auth/me', {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
              signal: currentFetchController.signal,
            });

            // If logout occurred during the request, do not apply the response
            if (get().isLoggedOut) {
              pushSessionLog('fetchUser aborted after response: isLoggedOut');
              set({ isLoading: false }, false, 'fetchUser:aborted-after-response-logged-out');
              return;
            }

            if (response.ok) {
              const userData = await response.json();
              pushSessionLog(`fetchUser:success ${userData?.id ?? '-'} ${userData?.email ?? '-'}`);
              set(
                { user: userData, lastFetch: Date.now(), isLoading: false, error: null },
                false,
                'fetchUser:success'
              );
            } else if (response.status === 401) {
              // Unauthorized - kullanıcı oturum açmamış
              pushSessionLog('fetchUser:unauthorized');
              set(
                { user: null, lastFetch: Date.now(), isLoading: false, error: null },
                false,
                'fetchUser:unauthorized'
              );
            } else {
              pushSessionLog(`fetchUser:error status=${response.status}`);
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
            console.error('[session-store] fetchUser:catch', error);
            pushSessionLog(`[fetchUser:catch] ${String(error)}`);
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
          } finally {
            // Clear controller reference when request finished/errored
            currentFetchController = null;
            pushSessionLog('fetchUser finished (finally)');
          }
        },

        clearSession: () => {
          // Avoid redundant updates which could trigger re-render loops
          const st = get();
          if (st.isLoggedOut && st.user == null) return;
          console.debug('[session-store] clearSession called — marking isLoggedOut');
          set(
            { user: null, isLoading: false, lastFetch: null, error: null, isLoggedOut: true },
            false,
            'clearSession'
          );
        },

        applyLoginResult: (user) => {
          // Called by client components after a server-side login action returns
          try { console.debug('[session-store] applyLoginResult', !!user, user ? { id: user.id, email: user.email } : null); } catch {}
          // Reset internal fetch counters and mark logged-in
          sessionFetchAttempts = 0;
          lastFetchAttemptTs = 0;
          // Merge with any client-side persisted user data (e.g. image_url)
          let finalUser = user;
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              const raw = window.localStorage.getItem('session-storage');
              if (raw) {
                const parsed = JSON.parse(raw);
                const persistedUser = parsed?.user ?? parsed;
                if (persistedUser && typeof persistedUser === 'object') {
                  if (!persistedUser.id || persistedUser.id === user?.id) {
                    finalUser = { ...(user ?? {}), ...persistedUser } as any;
                  }
                }
              }
            }
          } catch (e) {
            try { console.warn('[session-store] applyLoginResult: failed to merge persisted user', e); } catch {}
          }
          set({ user: finalUser, lastFetch: Date.now(), isLoggedOut: false, error: null, isLoading: false }, false, 'applyLoginResult');
        },

        logoutClient: async () => {
          try {
            const st = get();
            // If already logged out locally, avoid calling API again — but still
            // attempt server logout if desired. To prevent loops, return early.
            if (st.isLoggedOut && st.user == null) {
              return { status: 'success' };
            }
            // Call internal API route which proxies to backend and clears cookies
            const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store' });
            if (!res.ok) {
              try { const body = await res.json(); return { status: 'error', message: body?.error || 'Logout failed', statusCode: res.status }; } catch {}
              return { status: 'error', message: 'Logout failed', statusCode: res.status };
            }
            // Clear local client session (only if needed)
            const cur = get();
            if (!(cur.isLoggedOut && cur.user == null)) {
              set({ user: null, isLoading: false, lastFetch: null, error: null, isLoggedOut: true }, false, 'logoutClient');
            }
            return { status: 'success' };
          } catch (e) {
            console.error('[session-store] logoutClient error', e);
            return { status: 'error', message: String(e), statusCode: 500 };
          }
        },

        shouldRefetch: () => {
          const { lastFetch, isLoggedOut } = get();
          // If we've explicitly logged out, do not refetch
          if (isLoggedOut) return false;
          if (!lastFetch) return true;
          return Date.now() - lastFetch > REFETCH_INTERVAL;
        },
        // Reset the logged out flag after a successful login or explicit reset
        resetLoggedOut: () => {
          console.debug('[session-store] resetLoggedOut called');
          set({ isLoggedOut: false }, false, 'resetLoggedOut');
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
export const useIsAuthenticated = () => useSessionStore((state) => !!state.user && !state.isLoggedOut);
export const useLoginClient = () => useSessionStore((state) => state.applyLoginResult);
export const useLogoutClient = () => useSessionStore((state) => state.logoutClient);
