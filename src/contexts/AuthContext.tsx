import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { clearAllPersistedForms } from '@/hooks/usePersistedState';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    let mounted = true;

    // Check for existing session first (important for browser back/forward)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        console.log('🔐 Initial session check:', { hasSession: !!session, userId: session?.user?.id });
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

      console.log(`🔐 Auth Event: ${event}`, { 
        hasSession: !!session, 
        userId: session?.user?.id,
        expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
      });

      // Handle specific auth events
      switch (event) {
        case 'TOKEN_REFRESHED':
          console.log('✅ Token refreshed successfully');
          break;
          
        case 'SIGNED_OUT':
          console.log('🚪 User signed out');
          sessionStorage.removeItem('redirectAfterLogin');
          clearAllPersistedForms();
          // Don't navigate here as signOut function handles it
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
          break;
          
        case 'INITIAL_SESSION':
          console.log('🔍 Initial session loaded');
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
  }, [navigate]);

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
      sessionStorage.clear();
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

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
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
