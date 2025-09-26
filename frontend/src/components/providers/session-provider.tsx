"use client";
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
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
  const [user, setUser] = useState<User | null>(initialUser || null);
  const [isLoading, setIsLoading] = useState(!initialUser);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Check session function
  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  // Check session on mount if no initial user
  useEffect(() => {
    if (!initialUser) {
      checkSession();
    } else {
      setIsLoading(false);
    }
  }, [checkSession, initialUser]);

  const refreshSession = async (): Promise<void> => {
    await checkSession();
  };

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