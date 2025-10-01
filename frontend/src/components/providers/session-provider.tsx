"use client";
import React, { createContext, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { User } from '@/types/user/user';
import { useSessionStore } from '@/stores/session-store';

interface SessionContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
  initialUser?: User | null;
  disabled?: boolean;
}

export function SessionProvider({ children, initialUser, disabled = false }: SessionProviderProps) {
  const pathname = usePathname();
  const initRef = useRef(false);

  // Zustand store'dan state ve actions
  const user = useSessionStore((state) => state.user);
  const isLoading = useSessionStore((state) => state.isLoading);
  const error = useSessionStore((state) => state.error);
  const fetchUser = useSessionStore((state) => state.fetchUser);
  const setUser = useSessionStore((state) => state.setUser);
  const clearSession = useSessionStore((state) => state.clearSession);
  const shouldRefetch = useSessionStore((state) => state.shouldRefetch);

  // Check if current route is public (no session needed)
  const isPublicRoute = pathname?.startsWith('/auth/') || pathname === '/';

  // Refresh session fonksiyonu - force refresh yapmak için
  const refreshSession = useCallback(async (): Promise<void> => {
    if (disabled || isPublicRoute) {
      return;
    }
    await fetchUser();
  }, [disabled, isPublicRoute, fetchUser]);

  // Initial user varsa store'a set et
  useEffect(() => {
    if (initialUser && !user && !initRef.current) {
      setUser(initialUser);
      initRef.current = true;
    }
  }, [initialUser, user, setUser]);

  // İlk yüklemede veya refetch gerektiğinde user fetch et
  useEffect(() => {
    if (!disabled && !isPublicRoute && shouldRefetch()) {
      void fetchUser();
    }
  }, [disabled, isPublicRoute, shouldRefetch, fetchUser]);

  const value: SessionContextType = {
    user,
    isLoading,
    error,
    refreshSession,
    clearSession,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}