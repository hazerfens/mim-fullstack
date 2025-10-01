/**
 * Session helper functions
 * Client-side helper functions for session management
 */

import { useSessionStore } from '@/stores/session-store';

/**
 * Clear session from client-side store
 * Call this after logout or when tokens are invalid
 */
export function clearClientSession() {
  if (typeof window !== 'undefined') {
    useSessionStore.getState().clearSession();
  }
}

/**
 * Force refresh session from server
 * Bypasses cache and refetch interval
 */
export async function forceRefreshSession() {
  if (typeof window !== 'undefined') {
    const store = useSessionStore.getState();
    store.setLoading(true);
    await store.fetchUser();
  }
}
