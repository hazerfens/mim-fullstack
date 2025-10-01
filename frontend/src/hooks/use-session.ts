/**
 * Session hooks - Export Zustand store hooks for direct use
 * Use these hooks when you don't need the full SessionProvider context
 * and just want to access the session state
 */

export {
  useSessionStore,
  useUser,
  useIsLoading,
  useSessionError,
} from '@/stores/session-store';

export { useSession } from '@/components/providers/session-provider';
export { clearClientSession, forceRefreshSession } from '@/lib/session-helpers';
