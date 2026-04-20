import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { profileKeys } from '@/hooks/queries';
import { clearAllPersistedForms } from '@/hooks/usePersistedState';
import { supabase, PERLEAP_AUTH_STORAGE_KEY } from '@/integrations/supabase/client';
import { getTeacherProfile, getStudentProfile } from '@/services/profileService';
import {
  shouldAttemptRecovery,
  attemptRoleRecovery,
  incrementRecoveryAttempt,
} from '@/utils/roleRecovery';
import { isSignupInProgress, clearAllSignupState } from '@/utils/sessionState';
import { ACCOUNT_JUST_DELETED_SESSION_KEY } from '@/utils/accountDeletionRedirect';

interface UserProfile {
  full_name: string;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
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
  const queryClient = useQueryClient();

  // Initial loading state for the core auth session
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  // Profile query using TanStack Query
  const {
    data: profileData,
    isLoading: isProfileQueryLoading,
    isFetched: isProfileFetched,
    refetch,
  } = useQuery({
    queryKey:
      user?.user_metadata?.role === 'teacher'
        ? profileKeys.teacher(user?.id || '')
        : profileKeys.student(user?.id || ''),
    queryFn: async () => {
      if (!user?.id) return null;
      const role = user.user_metadata?.role;
      if (!role) return null;

      console.log(`🔄 AuthContext: Fetching fresh profile for ${role}...`);
      const { data, error } =
        role === 'teacher' ? await getTeacherProfile(user.id) : await getStudentProfile(user.id);

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      console.log('✅ AuthContext: Profile found');
      return data;
    },
    // Only run the query if we have a user ID and a role
    enabled: !!user?.id && !!user?.user_metadata?.role,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Map query states to context values
  // profile: the actual data
  const profile = profileData || null;

  // isProfileLoading: only true on the initial fetch to avoid full-page unmounts on background refreshes
  const isProfileLoading = user ? isProfileQueryLoading && !isProfileFetched : false;

  // hasProfile: null if not yet determined, true if data exists, false if no profile found
  const hasProfile = isProfileFetched ? !!profileData : null;

  // Token refresh failure recovery
  const handleTokenRefreshFailure = async () => {
    console.log('🔄 Attempting session recovery after token refresh failure...');

    try {
      const { data, error } = await supabase.auth.getSession();

      if (data?.session) {
        console.log('✅ Session recovered successfully');
        setSession(data.session);
        setUser(data.session.user);
        return;
      }

      if (error) {
        console.error('❌ Session recovery failed:', error);
      }
    } catch (error) {
      console.error('❌ Session recovery exception:', error);
    }

    // Only logout if recovery fails
    console.log('🚪 Logging out due to unrecoverable session');
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (signOutErr) {
      console.error('Sign out after refresh failure:', signOutErr);
    }
    clearAllPersistedForms();
    sessionStorage.clear();
    navigate('/auth');
  };

  useEffect(() => {
    let mounted = true;

    // Check for existing session first (important for browser back/forward)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        console.log('🔐 Initial session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
        });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    // Set up auth state listener for real-time changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Ignore auth events triggered by visibility changes to prevent unnecessary refetches
      if (document.hidden && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
        console.log(`🔕 Ignoring ${event} event while document is hidden`);
        return;
      }

      console.log(`🔐 Auth Event: ${event}`, {
        hasSession: !!session,
        userId: session?.user?.id,
        expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      });

      // Handle specific auth events
      switch (event as any) {
        case 'TOKEN_REFRESHED':
          console.log('✅ Token refreshed successfully');
          break;

        case 'SIGNED_OUT':
          console.log('🚪 User signed out');
          sessionStorage.removeItem('redirectAfterLogin');
          clearAllPersistedForms();
          clearAllSignupState();
          // Reset profile data in cache
          const signoutKey =
            user?.user_metadata?.role === 'teacher'
              ? profileKeys.teacher(user?.id || '')
              : profileKeys.student(user?.id || '');
          queryClient.setQueryData(signoutKey, null);
          break;

        case 'TOKEN_REFRESH_FAILED':
          console.error('❌ Token refresh failed - attempting recovery');
          await handleTokenRefreshFailure();
          return; // Don't update state, let recovery handle it

        case 'USER_UPDATED':
          console.log('👤 User metadata updated');
          break;

        case 'SIGNED_IN':
          console.log('✅ User signed in');
          if (session?.user) {
            const userRole = session.user.user_metadata?.role;

            // Check if user has role metadata
            if (!userRole || (userRole !== 'teacher' && userRole !== 'student')) {
              // Check if signup is in progress
              const signupInProgress = isSignupInProgress();

              // Check if this is a VERY new account (created < 5 minutes ago)
              const userCreatedAt = session.user.created_at
                ? new Date(session.user.created_at).getTime()
                : 0;
              const now = Date.now();
              const fiveMinutes = 5 * 60 * 1000;
              const isVeryNewAccount = now - userCreatedAt < fiveMinutes;

              // CRITICAL: Don't interfere if on callback page or signup is in progress OR account is brand new
              const isCallbackPage = window.location.pathname.includes('/auth/callback');
              if (signupInProgress || isVeryNewAccount || isCallbackPage) {
                if (signupInProgress) {
                  console.log('🔄 Signup in progress, skipping role check');
                } else if (isCallbackPage) {
                  console.log('🔄 On callback page, letting AuthCallback handle role assignment');
                } else {
                  console.log('🆕 Very new account detected, skipping role check');
                }
                break;
              }

              console.warn('⚠️ User signed in without valid role metadata');

              if (shouldAttemptRecovery()) {
                console.log('🔄 Attempting automatic role recovery...');
                incrementRecoveryAttempt();

                const { recovered, role } = await attemptRoleRecovery();

                if (recovered && role) {
                  console.log(`✅ Role recovered successfully: ${role}`);
                } else {
                  console.log('❌ Role recovery failed, redirecting to role selection');
                  navigate('/role-selection', { replace: true });
                  return;
                }
              } else {
                console.log('⚠️ Max recovery attempts reached, redirecting to role selection');
                navigate('/role-selection', { replace: true });
                return;
              }
            }
          }
          break;

        case 'INITIAL_SESSION':
          console.log('🔍 Initial session loaded');
          break;
      }

      // Update state only if changed to prevent unnecessary re-renders
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
  }, [user?.id, queryClient]);

  // Session health monitoring - check every 5 minutes
  useEffect(() => {
    const checkSessionHealth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('⚠️ Session health check error:', error);
          return;
        }

        if (session?.expires_at) {
          const expiresAt = session.expires_at * 1000;
          const now = Date.now();
          const timeToExpiry = expiresAt - now;
          const minutesToExpiry = Math.floor(timeToExpiry / (1000 * 60));

          console.log('🔍 Session health check:', {
            valid: !!session,
            expiresAt: new Date(expiresAt).toISOString(),
            minutesToExpiry,
            userId: session.user?.id,
          });

          if (minutesToExpiry < 10 && minutesToExpiry > 0) {
            console.warn(`⚠️ Session expiring in ${minutesToExpiry} minutes`);
          }
        } else {
          console.log('🔍 Session health check: No active session');
        }
      } catch (error) {
        console.error('❌ Session health check exception:', error);
      }
    };

    const initialTimeout = setTimeout(checkSessionHealth, 60 * 1000);
    const interval = setInterval(checkSessionHealth, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const signOut = async (
    redirectPath: string = '/',
    options?: { scope?: 'global' | 'local'; skipSupabaseRemoteSignOut?: boolean }
  ) => {
    const signOutScope = options?.scope ?? 'global';
    const skipRemote = options?.skipSupabaseRemoteSignOut === true;

    try {
      if (skipRemote) {
        // Server already removed the user; GoTrue still POSTs /logout for any scope → browser 403 noise.
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
      // Perform heavy cleanup in the next tick to prevent blocking the UI
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
  };

  const refreshProfile = async (force: boolean = false) => {
    const key =
      user?.user_metadata?.role === 'teacher'
        ? profileKeys.teacher(user?.id || '')
        : profileKeys.student(user?.id || '');

    if (force) {
      await queryClient.invalidateQueries({ queryKey: key });
    } else {
      await refetch();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signOut,
        refreshProfile,
        hasProfile,
        isProfileLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
