/* eslint-disable react-refresh/only-export-components -- co-located helpers/variants */
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthProfileQuery } from './auth/useAuthProfileQuery';
import { useAuthSessionEffects } from './auth/useAuthSessionEffects';
import { useSessionHealthMonitor } from './auth/useSessionHealthMonitor';
import type { AuthUserProfile } from './auth/types';
import type { Session, User } from '@supabase/supabase-js';
import { USER_ROLES } from '@/config/constants';
import { profileKeys } from '@/hooks/queries';
import { clearAllPersistedForms } from '@/hooks/usePersistedState';
import { supabase, PERLEAP_AUTH_STORAGE_KEY } from '@/integrations/supabase/client';
import { ACCOUNT_JUST_DELETED_SESSION_KEY } from '@/utils/accountDeletionRedirect';
import { clearAllSignupState } from '@/utils/sessionState';
import {
  prefetchAvatarBlob,
  STUDENT_AVATARS_BUCKET,
  TEACHER_AVATARS_BUCKET,
} from '@/utils/storageUrls';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AuthUserProfile | null;
  loading: boolean;
  signOut: (
    redirectPath?: string,
    options?: { scope?: 'global' | 'local'; skipSupabaseRemoteSignOut?: boolean }
  ) => Promise<void>;
  refreshProfile: (force?: boolean) => Promise<void>;
  hasProfile: boolean | null;
  isProfileLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Defined in this file (not a separate module) so Vite HMR cannot desync `AuthContext` from `AuthProvider`. */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { profile, hasProfile, isProfileLoading, refetch } = useAuthProfileQuery(user);

  useEffect(() => {
    const avatarUrl = profile?.avatar_url;
    if (!avatarUrl) return;

    const role = user?.user_metadata?.role;
    const bucket =
      role === 'teacher' || role === USER_ROLES.ADMIN
        ? TEACHER_AVATARS_BUCKET
        : STUDENT_AVATARS_BUCKET;
    prefetchAvatarBlob(avatarUrl, bucket);
  }, [profile?.avatar_url, user?.user_metadata?.role]);

  const handleTokenRefreshFailure = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (data?.session) {
        setSession(data.session);
        setUser(data.session.user);
        return;
      }

      if (error) {
        console.error('Session recovery failed:', error);
      }
    } catch (error) {
      console.error('Session recovery exception:', error);
    }

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (signOutErr) {
      console.error('Sign out after refresh failure:', signOutErr);
    }
    clearAllPersistedForms();
    sessionStorage.clear();
    navigate('/auth');
  }, [navigate]);

  useAuthSessionEffects({
    navigate,
    queryClient,
    setUser,
    setSession,
    setLoading,
    onTokenRefreshFailure: handleTokenRefreshFailure,
  });

  useSessionHealthMonitor();

  const signOut = useCallback(
    async (
      redirectPath: string = '/',
      options?: { scope?: 'global' | 'local'; skipSupabaseRemoteSignOut?: boolean }
    ) => {
      const signOutScope = options?.scope ?? 'global';
      const skipRemote = options?.skipSupabaseRemoteSignOut === true;

      try {
        if (skipRemote) {
          try {
            await supabase.auth.stopAutoRefresh();
          } catch {
            /* ignore */
          }
          try {
            localStorage.removeItem(PERLEAP_AUTH_STORAGE_KEY);
            localStorage.removeItem(`${PERLEAP_AUTH_STORAGE_KEY}-code-verifier`);
            localStorage.removeItem(`${PERLEAP_AUTH_STORAGE_KEY}-user`);
          } catch {
            /* ignore */
          }
          setUser(null);
          setSession(null);
        } else {
          await supabase.auth.signOut(signOutScope === 'local' ? { scope: 'local' } : undefined);
        }
      } catch (error) {
        console.error('Sign out failed, cleaning up locally:', error);
      } finally {
        setTimeout(() => {
          clearAllPersistedForms();
          clearAllSignupState();
          const sessionKeysToKeep = [ACCOUNT_JUST_DELETED_SESSION_KEY];
          for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (key && !sessionKeysToKeep.includes(key)) {
              sessionStorage.removeItem(key);
            }
          }
          queryClient.clear();

          const keysToKeep = ['language_preference'];
          const allKeys = Object.keys(localStorage);
          allKeys.forEach((key) => {
            if (!keysToKeep.includes(key)) {
              localStorage.removeItem(key);
            }
          });
          if (skipRemote && typeof window !== 'undefined') {
            if (redirectPath.startsWith('http://') || redirectPath.startsWith('https://')) {
              window.location.assign(redirectPath);
            } else {
              const path = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
              window.location.assign(`${window.location.origin}${path}`);
            }
          } else {
            navigate(redirectPath);
          }
        }, 0);
      }
    },
    [navigate, queryClient]
  );

  const refreshProfile = useCallback(
    async (force: boolean = false) => {
      const r = user?.user_metadata?.role;
      const key =
        r === USER_ROLES.ADMIN
          ? (['auth', 'admin-profile', user?.id || ''] as const)
          : r === 'teacher'
            ? profileKeys.teacher(user?.id || '')
            : profileKeys.student(user?.id || '');

      if (force) {
        await queryClient.invalidateQueries({ queryKey: key });
      } else {
        await refetch();
      }
    },
    [user, queryClient, refetch]
  );

  const contextValue = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      signOut,
      refreshProfile,
      hasProfile,
      isProfileLoading,
    }),
    [user, session, profile, loading, signOut, refreshProfile, hasProfile, isProfileLoading]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
