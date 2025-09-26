"use client";
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { User } from '@/types/user/user';

interface SessionContextType {
  user: User | null;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
  initialUser?: User | null;
}

export function SessionProvider({ children, initialUser }: SessionProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Session refresh failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialUser) {
      void refreshSession();
    }
  }, [initialUser, refreshSession]);

  const value: SessionContextType = {
    user,
    isLoading,
    refreshSession,
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