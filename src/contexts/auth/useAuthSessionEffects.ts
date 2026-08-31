import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import type { NavigateFunction } from 'react-router-dom';
import { USER_ROLES } from '@/config/constants';
import { profileKeys } from '@/hooks/queries';
import { clearAllPersistedForms } from '@/hooks/usePersistedState';
import { supabase } from '@/integrations/supabase/client';
import {
  shouldAttemptRecovery,
  attemptRoleRecovery,
  incrementRecoveryAttempt,
} from '@/utils/roleRecovery';
import { isSignupInProgress, clearAllSignupState } from '@/utils/sessionState';
import { authDebug } from './authDebug';

type AuthSessionEffectsArgs = {
  navigate: NavigateFunction;
  queryClient: QueryClient;
  setUser: Dispatch<SetStateAction<User | null>>;
  setSession: Dispatch<SetStateAction<Session | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  onTokenRefreshFailure: () => Promise<void>;
};

export function useAuthSessionEffects({
  navigate,
  queryClient,
  setUser,
  setSession,
  setLoading,
  onTokenRefreshFailure,
}: AuthSessionEffectsArgs) {
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        authDebug('Initial session check', { hasSession: !!session, userId: session?.user?.id });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (document.hidden && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
        authDebug(`Ignoring ${event} while document hidden`);
        return;
      }

      authDebug(`Auth event: ${event}`, {
        hasSession: !!session,
        userId: session?.user?.id,
      });

      if ((event as string) === 'TOKEN_REFRESH_FAILED') {
        console.error('Token refresh failed — attempting recovery');
        await onTokenRefreshFailure();
        return;
      }

      switch (event) {
        case 'SIGNED_OUT':
          sessionStorage.removeItem('redirectAfterLogin');
          clearAllPersistedForms();
          clearAllSignupState();
          {
            const r = session?.user?.user_metadata?.role;
            const signoutKey =
              r === USER_ROLES.ADMIN
                ? (['auth', 'admin-profile', session?.user?.id || ''] as const)
                : r === 'teacher'
                  ? profileKeys.teacher(session?.user?.id || '')
                  : profileKeys.student(session?.user?.id || '');
            queryClient.setQueryData(signoutKey, null);
          }
          break;

        case 'SIGNED_IN':
          if (session?.user) {
            const userRole = session.user.user_metadata?.role;

            if (
              !userRole ||
              (userRole !== 'teacher' && userRole !== 'student' && userRole !== USER_ROLES.ADMIN)
            ) {
              const signupInProgress = isSignupInProgress();
              const userCreatedAt = session.user.created_at
                ? new Date(session.user.created_at).getTime()
                : 0;
              const isVeryNewAccount = Date.now() - userCreatedAt < 5 * 60 * 1000;
              const isCallbackPage = window.location.pathname.includes('/auth/callback');

              if (signupInProgress || isVeryNewAccount || isCallbackPage) {
                break;
              }

              console.warn('User signed in without valid role metadata');

              if (shouldAttemptRecovery()) {
                incrementRecoveryAttempt();
                const { recovered, role } = await attemptRoleRecovery();

                if (!recovered || !role) {
                  navigate('/role-selection', { replace: true });
                  return;
                }
              } else {
                navigate('/role-selection', { replace: true });
                return;
              }
            }
          }
          break;

        default:
          break;
      }

      setSession((prev) => {
        if (
          prev?.access_token === session?.access_token &&
          prev?.expires_at === session?.expires_at
        ) {
          return prev;
        }
        return session;
      });

      setUser((prev) => {
        if (
          prev?.id === session?.user?.id &&
          JSON.stringify(prev?.user_metadata) === JSON.stringify(session?.user?.user_metadata)
        ) {
          return prev;
        }
        return session?.user ?? null;
      });

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, queryClient, onTokenRefreshFailure, setLoading, setSession, setUser]);
}
