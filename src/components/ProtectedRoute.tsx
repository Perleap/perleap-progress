import { Loader2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'teacher' | 'student';
  redirectTo?: string;
}

const ProtectedRoute = ({ children, requiredRole, redirectTo = '/auth' }: ProtectedRouteProps) => {
  const { user, session, loading, hasProfile, isProfileLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasNavigated = useRef(false);

  // Validate session freshness
  const isSessionValid = (session: Session | null) => {
    if (!session) return false;

    // Check if session has expiration time
    if (session.expires_at) {
      const expiresAt = session.expires_at * 1000; // Convert to milliseconds
      const now = Date.now();
      const isValid = expiresAt > now;

      if (!isValid) {
        console.warn('⚠️ Session has expired', {
          expiresAt: new Date(expiresAt).toISOString(),
          now: new Date(now).toISOString(),
        });
      }

      return isValid;
    }

    return true; // If no expiration time, assume valid
  };

  useEffect(() => {
    // Reset navigation flag when location changes
    hasNavigated.current = false;
  }, [location.pathname]);

  useEffect(() => {
    const checkAccessAndNavigate = async () => {
      // Don't navigate while core auth is loading
      if (loading) return;

      // If we have a user but are still checking for their profile, wait
      // unless we already have a profile in cache (handled by AuthContext)
      if (user && hasProfile === null && isProfileLoading) return;

      if (hasNavigated.current) return; // Prevent multiple navigations

      const currentPath = location.pathname;

      // Redirect to auth if not authenticated or session is invalid
      if (!user || !session || !isSessionValid(session)) {
        // Prevent navigation loop - don't redirect if already at redirectTo
        if (currentPath === redirectTo) {
          return;
        }

        console.log('🔒 Protected route: No valid session, redirecting to auth');

        // Save current path for post-login redirect (except auth pages)
        if (!currentPath.startsWith('/auth') && currentPath !== '/') {
          sessionStorage.setItem('redirectAfterLogin', currentPath);
        }

        hasNavigated.current = true;
        navigate(redirectTo, { replace: true });
        return;
      }

      // Check role-based access
      if (requiredRole) {
        const userRole = user.user_metadata?.role;

        if (userRole !== requiredRole) {
          console.log('🔒 Protected route: Role mismatch', {
            required: requiredRole,
            actual: userRole,
          });

          const dashboardRoute =
            userRole === 'teacher'
              ? '/teacher/dashboard'
              : userRole === 'student'
                ? '/student/dashboard'
                : '/role-selection';

          // Prevent navigation loop
          if (currentPath !== dashboardRoute) {
            hasNavigated.current = true;
            navigate(dashboardRoute, { replace: true });
          }
          return;
        }

        // Check if user has completed their profile (unless they're on onboarding page)
        if (!currentPath.startsWith('/onboarding/')) {
          // Use cached profile check from AuthContext
          // Only redirect if we ARE NOT currently loading the profile and we know it's missing
          if (hasProfile === false && !isProfileLoading) {
            console.log(
              `🔒 Protected route: User has ${userRole} role but no profile, redirecting to onboarding`
            );
            const onboardingPath = `/onboarding/${userRole}`;

            if (currentPath !== onboardingPath) {
              hasNavigated.current = true;
              navigate(onboardingPath, { replace: true });
            }
            return;
          }
        }
      }
    };

    checkAccessAndNavigate();
  }, [
    user,
    session,
    loading,
    requiredRole,
    navigate,
    redirectTo,
    location.pathname,
    hasProfile,
    isProfileLoading,
  ]);

  // STABILIZED LOADING CHECK:
  // Only show the full-page loader if:
  // 1. Initial auth is loading
  // 2. We have a user but haven't determined if they have a profile yet AND it's currently being fetched
  const shouldShowLoader = loading || (user && isProfileLoading && !hasProfile);

  if (shouldShowLoader) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    return null;
  }

  if (requiredRole && user.user_metadata?.role !== requiredRole) {
    const actualRole = user.user_metadata?.role;
    if (actualRole !== 'teacher' && actualRole !== 'student') {
      return <Navigate to="/role-selection" replace />;
    }
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
