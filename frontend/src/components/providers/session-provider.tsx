"use client";
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { User } from '@/types/user/user';
import { useSessionStore, useUser, useIsLoading, useSessionError } from '@/stores/session-store';
import { useCompanyStore, Company } from '@/stores/company-store';
import { getSessionFetchAttempts, isSessionFetchInFlight } from '@/stores/session-store';

interface SessionContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
  clearSession: () => void;
}


interface SessionProviderProps {
  children: ReactNode;
  initialUser?: User | null;
  disabled?: boolean;
  initialCompanies?: Company[] | null;
  initialActiveCompany?: Company | null;
}

export function SessionProvider({ children, initialUser, disabled = false, initialCompanies = null, initialActiveCompany = null }: SessionProviderProps) {
  const pathname = usePathname();
  const initRef = useRef(false);

  // Zustand store'dan state ve actions (selectors give better render perf)
  const user = useSessionStore((state) => state.user);
  const isLoading = useSessionStore((state) => state.isLoading);
  const fetchUser = useSessionStore((state) => state.fetchUser);
  const setUser = useSessionStore((state) => state.setUser);
  const shouldRefetch = useSessionStore((state) => state.shouldRefetch);
  const isLoggedOut = useSessionStore((state) => state.isLoggedOut);
  const resetLoggedOut = useSessionStore((state) => state.resetLoggedOut);
  
  const hydrateCompanies = useCompanyStore((state) => state.hydrateCompanies);

  // Check if current route is public (no session needed)
  const isPublicRoute = pathname?.startsWith('/auth/') || pathname === '/';

  // Mounted guard to avoid SSR/CSR markup differences
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // Local UI for debug overlay collapsed state
  const [debugCollapsed, setDebugCollapsed] = useState(false);

  // Note: public refresh/clear actions are exposed via the useSession() hook

  // Initial user varsa store'a set et
  useEffect(() => {
    if (initialUser && !user && !initRef.current) {
      // Try to merge any client-side persisted user data (e.g. image_url)
      // stored in localStorage by other client flows. The zustand persist
      // key is `session-storage` and contains { user, lastFetch }.
      let finalUser = initialUser;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = window.localStorage.getItem('session-storage');
          if (raw) {
            const parsed = JSON.parse(raw);
            const persistedUser = parsed?.user ?? parsed;
            // Merge persisted fields when they exist (persisted wins for
            // client-only fields like image_url).
            if (persistedUser && typeof persistedUser === 'object') {
              // Only merge when IDs match or when persistedUser looks like a user
              if (!persistedUser.id || persistedUser.id === initialUser.id) {
                finalUser = { ...initialUser, ...persistedUser } as typeof initialUser;
              }
            }
          }
        }
      } catch (e) {
        // Ignore any parse errors and fall back to server-provided initialUser
        try { console.warn('[session-provider] failed to merge persisted user', e); } catch {}
      }

      setUser(finalUser);
      // If the server provided an initial user, clear the logged out guard so
      // subsequent client-side refetching can happen normally.
      resetLoggedOut();
      initRef.current = true;
    }
  }, [initialUser, user, setUser, resetLoggedOut]);

  // Hydrate companies from server-provided initial props if available in the
  // layout. This avoids client-side re-fetch storms on page load.
  useEffect(() => {
    if (initialCompanies && hydrateCompanies) {
      hydrateCompanies(initialCompanies, initialActiveCompany ?? null);
    }
  }, [initialCompanies, initialActiveCompany, hydrateCompanies]);

  // Watch user changes: when user logs in, fetch company list and active
  // company; when user logs out, clear company store. This makes the
  // company store react to auth changes automatically.
  useEffect(() => {
    if (user) {
      // On login: prefer client-persisted company data to avoid needless
      // server-side queries. If localStorage contains company info saved
      // from previous interactions (switch/add/select), hydrate the
      // company store from it. Only fall back to server fetch when no
      // persisted data exists.
      try {
        const cs = useCompanyStore.getState();
        let hydrated = false;
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            const raw = window.localStorage.getItem('company-storage');
            if (raw) {
              const parsed = JSON.parse(raw);
              const persistedActive = parsed?.activeCompany ?? parsed?.activeCompany;
              const persistedCompanies = parsed?.companies ?? null;
              if (persistedActive || persistedCompanies) {
                const companiesArr = Array.isArray(persistedCompanies) ? persistedCompanies : [];
                cs.hydrateCompanies(companiesArr, persistedActive ?? null);
                hydrated = true;
              }
            }
          } catch (e) {
            try { console.warn('[session-provider] failed to read persisted companies', e); } catch {}
          }
        }
        // If nothing persisted, do the usual non-blocking fetches
        if (!hydrated) {
          if (cs.fetchCompanies) void cs.fetchCompanies();
          if (cs.fetchActiveCompany) void cs.fetchActiveCompany();
        }
      } catch {
        // swallow
      }
    } else {
      // On logout: clear company store to avoid leaking data between users
      try {
        const cs = useCompanyStore.getState();
        // Avoid calling clearCompanies if there is nothing to clear — this
        // prevents no-op state updates that can lead to repeated renders.
        if ((cs.companies && cs.companies.length > 0) || cs.activeCompany) {
          if (cs.clearCompanies) cs.clearCompanies();
        }
      } catch {}
    }
  }, [user]);

  // İlk yüklemede veya refetch gerektiğinde user fetch et
  useEffect(() => {
    if (isLoggedOut) return; // Do not auto refetch when explicitly logged out
    if (!disabled && !isPublicRoute && shouldRefetch()) {
      void fetchUser();
    }
  }, [disabled, isPublicRoute, shouldRefetch, fetchUser, isLoggedOut]);

  return (
    <>
      {children}
      {/* Dev-only session debug overlay. Enable with NODE_ENV=development or ?debug=session */}
      {/* Render overlay only after client mount to avoid SSR/client markup mismatches */}
      {mounted && (process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && new URL(window.location.href).searchParams.get('debug') === 'session')) && (
        debugCollapsed ? (
          <div style={{position:'fixed',right:12,bottom:12,zIndex:9999}}>
            <button
              onClick={() => setDebugCollapsed(false)}
              aria-expanded={false}
              style={{background:'rgba(0,0,0,0.8)',color:'#fff',padding:'6px 8px',borderRadius:6,border:'none',cursor:'pointer'}}
            >
              Session Debug ▸
            </button>
          </div>
        ) : (
          <div style={{position:'fixed',right:12,bottom:12,zIndex:9999,background:'rgba(0,0,0,0.8)',color:'#fff',padding:10,borderRadius:8,fontSize:12,maxWidth:320,lineHeight:1.2}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <div style={{fontWeight:600}}>Session Debug</div>
              <div>
                <button onClick={() => setDebugCollapsed(true)} style={{marginRight:8,border:'none',background:'transparent',color:'#fff',cursor:'pointer'}}>Collapse</button>
                <button onClick={() => { useSessionStore.getState().resetLoggedOut(); }} style={{border:'none',background:'transparent',color:'#fff',cursor:'pointer'}}>Reset</button>
              </div>
            </div>
            <div>User: {user?.email ?? 'null'}</div>
            <div>isLoading: {String(isLoading)}</div>
            <div>isLoggedOut: {String(useSessionStore.getState().isLoggedOut)}</div>
            <div>lastFetch: {useSessionStore.getState().lastFetch ?? 'null'}</div>
            <div>fetchAttempts: {getSessionFetchAttempts()}</div>
            <div>fetchInFlight: {String(isSessionFetchInFlight())}</div>
          </div>
        )
      )}
    </>
  );
}

export function useSession(): SessionContextType {
  // Backwards-compatible hook that returns the auth state and actions from
  // the central zustand store. This avoids prop-drilling and React context
  // re-renders while keeping the same API.
  const user = useUser();
  const isLoading = useIsLoading();
  const error = useSessionError();
  const refreshSession = useSessionStore((s) => s.fetchUser);
  const clearSession = useSessionStore((s) => s.clearSession);
  return { user, isLoading, error, refreshSession, clearSession };
}