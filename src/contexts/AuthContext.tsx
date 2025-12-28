import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { clearAllPersistedForms } from '@/hooks/usePersistedState';
import { shouldAttemptRecovery, attemptRoleRecovery, incrementRecoveryAttempt } from '@/utils/roleRecovery';
import { isSignupInProgress, clearAllSignupState } from '@/utils/sessionState';

interface UserProfile {
  full_name: string;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: (force?: boolean) => Promise<void>;
  hasProfile: boolean | null;
  isProfileLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  
  // Initialize profile from sessionStorage to survive component remounts
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = sessionStorage.getItem('auth_profile_cache');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  
  // Initialize loading based on whether we have a session check to do
  const [loading, setLoading] = useState(true);
  
  // Profile caching state
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [lastProfileFetch, setLastProfileFetch] = useState<number>(() => {
    try {
      const cached = sessionStorage.getItem('auth_profile_fetch_time');
      return cached ? parseInt(cached, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  
  // Use sessionStorage to persist fetch flag across potential component recreations
  // Clear stale flags (older than 10 seconds - likely from aborted fetch)
  const getInitialFetchingState = () => {
    try {
      const flagTime = sessionStorage.getItem('auth_fetching_profile_time');
      if (!flagTime) return false;
      
      const timeSinceSet = Date.now() - parseInt(flagTime, 10);
      if (timeSinceSet > 10000) {
        // Stale flag, clear it
        sessionStorage.removeItem('auth_fetching_profile');
        sessionStorage.removeItem('auth_fetching_profile_time');
        return false;
      }
      
      return sessionStorage.getItem('auth_fetching_profile') === 'true';
    } catch {
      return false;
    }
  };
  
  const isFetchingProfile = useRef(getInitialFetchingState());
  
  const navigate = useNavigate();

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
    clearAllPersistedForms();
    sessionStorage.clear();
    navigate('/auth');
  };

  const fetchProfile = async (userId: string, role?: string, force: boolean = false) => {
    if (!userId) return;

    // Prevent concurrent profile fetches
    if (isFetchingProfile.current) {
      console.log('🔄 AuthContext: Profile fetch already in progress, skipping');
      return;
    }

    // Use cached profile if available and fresh (less than 5 minutes old)
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    if (!force && profile && (now - lastProfileFetch < CACHE_DURATION)) {
      console.log('🔄 AuthContext: Using cached profile data');
      // CRITICAL FIX: Ensure hasProfile is set to true when using cached data
      // This prevents infinite loading on page refresh when profile exists in cache
      if (hasProfile !== true) {
        setHasProfile(true);
      }
      return;
    }

    // If role isn't provided, try to get it from metadata
    const userRole = role || user?.user_metadata?.role;

    if (!userRole || (userRole !== 'teacher' && userRole !== 'student')) {
      return;
    }

    try {
      isFetchingProfile.current = true;
      sessionStorage.setItem('auth_fetching_profile', 'true');
      sessionStorage.setItem('auth_fetching_profile_time', Date.now().toString());
      setIsProfileLoading(true);
      console.log(`🔄 AuthContext: Fetching fresh profile for ${userRole}...`);
      
      // OPTIMIZED: Only fetch the profile for the user's role (no dual profile check)
      const table = userRole === 'teacher' ? 'teacher_profiles' : 'student_profiles';
      const { data, error } = await supabase
        .from(table)
        .select('full_name, avatar_url')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setHasProfile(false);
        return;
      }

      setLastProfileFetch(now);
      
      if (data) {
        console.log('✅ AuthContext: Profile found and cached');
        setProfile(data);
        setHasProfile(true);
        // Persist profile and fetch time to sessionStorage
        sessionStorage.setItem('auth_profile_cache', JSON.stringify(data));
        sessionStorage.setItem('auth_profile_fetch_time', now.toString());
      } else {
        console.log('⚠️ AuthContext: No profile found');
        setHasProfile(false);
        setProfile(null);
        // Clear sessionStorage
        sessionStorage.removeItem('auth_profile_cache');
        sessionStorage.removeItem('auth_profile_fetch_time');
      }
    } catch (error) {
      console.error('Exception fetching profile:', error);
      setHasProfile(false);
    } finally {
      setIsProfileLoading(false);
      isFetchingProfile.current = false;
      sessionStorage.removeItem('auth_fetching_profile');
      sessionStorage.removeItem('auth_fetching_profile_time');
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check for existing session first (important for browser back/forward)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        console.log('🔐 Initial session check:', { hasSession: !!session, userId: session?.user?.id });
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id, session.user.user_metadata?.role);
        }
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
        expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
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
          setProfile(null);
          setHasProfile(null);
          setLastProfileFetch(0);
          // Don't navigate here as signOut function handles it
          break;

        case 'TOKEN_REFRESH_FAILED':
          console.error('❌ Token refresh failed - attempting recovery');
          await handleTokenRefreshFailure();
          return; // Don't update state, let recovery handle it

        case 'USER_UPDATED':
          console.log('👤 User metadata updated');
          if (session?.user) {
            fetchProfile(session.user.id, session.user.user_metadata?.role);
          }
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
              // This helps catch fresh signups even if sessionStorage flag is lost
              const userCreatedAt = session.user.created_at ? new Date(session.user.created_at).getTime() : 0;
              const now = Date.now();
              const fiveMinutes = 5 * 60 * 1000;
              const isVeryNewAccount = (now - userCreatedAt) < fiveMinutes;
              
              // CRITICAL: Don't interfere if signup is in progress OR account is brand new
              if (signupInProgress || isVeryNewAccount) {
                if (signupInProgress) {
                  console.log('🔄 Signup in progress, skipping role check (will be set during signup)');
                } else {
                  console.log('🆕 Very new account detected (< 5 min old), skipping role check to allow signup to complete');
                }
                // Don't fetch profile or redirect, let the signup flow handle it
                break;
              }
              
              console.warn('⚠️ User signed in without valid role metadata (not during signup, not new account)');
              
              // Only attempt recovery if NOT actively signing up and within attempt limit
              if (shouldAttemptRecovery()) {
                console.log('🔄 Attempting automatic role recovery...');
                incrementRecoveryAttempt();
                
                const { recovered, role } = await attemptRoleRecovery();
                
                if (recovered && role) {
                  console.log(`✅ Role recovered successfully: ${role}`);
                  fetchProfile(session.user.id, role);
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
            } else {
              // Normal case: user has valid role
              fetchProfile(session.user.id, userRole);
            }
          }
          break;

        case 'INITIAL_SESSION':
          console.log('🔍 Initial session loaded (profile already fetched by getSession)');
          // Don't fetch profile here - already done by getSession() above
          break;
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty deps - only run once on mount, navigate is stable

  // Session health monitoring - check every 5 minutes
  useEffect(() => {
    const checkSessionHealth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

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
            userId: session.user?.id
          });

          // Warn if session is expiring soon (less than 10 minutes)
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

    // Initial check after 1 minute
    const initialTimeout = setTimeout(checkSessionHealth, 60 * 1000);

    // Then check every 5 minutes
    const interval = setInterval(checkSessionHealth, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
    } catch (error) {
      // If network fails, still clean up locally
      console.error('Sign out failed, cleaning up locally:', error);
    } finally {
      // Always clear local data even if API call fails
      clearAllPersistedForms();
      clearAllSignupState();
      sessionStorage.clear();
      setProfile(null);
      setHasProfile(null);
      setLastProfileFetch(0);
      // Clear auth-related localStorage items
      const keysToKeep = ['language_preference']; // Keep language preference
      const allKeys = Object.keys(localStorage);
      allKeys.forEach((key) => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });
      navigate('/');
    }
  };

  const refreshProfile = async (force: boolean = false) => {
    if (user) {
      await fetchProfile(user.id, user.user_metadata?.role, force);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      signOut, 
      refreshProfile,
      hasProfile,
      isProfileLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
