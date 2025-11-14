import { ReactNode, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'teacher' | 'student';
  redirectTo?: string;
}

const ProtectedRoute = ({ children, requiredRole, redirectTo = '/auth' }: ProtectedRouteProps) => {
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasNavigated = useRef(false);

  // Validate session freshness
  const isSessionValid = (session: any) => {
    if (!session) return false;
    
    // Check if session has expiration time
    if (session.expires_at) {
      const expiresAt = session.expires_at * 1000; // Convert to milliseconds
      const now = Date.now();
      const isValid = expiresAt > now;
      
      if (!isValid) {
        console.warn('⚠️ Session has expired', {
          expiresAt: new Date(expiresAt).toISOString(),
          now: new Date(now).toISOString()
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
    if (loading) return;
    if (hasNavigated.current) return; // Prevent multiple navigations

    const currentPath = location.pathname;

    // Redirect to auth if not authenticated or session is invalid
    if (!user || !session || !isSessionValid(session)) {
      // Prevent navigation loop - don't redirect if already at redirectTo
      if (currentPath === redirectTo) {
        console.log('🔒 Already at auth page, skipping redirect');
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
          actual: userRole 
        });

        const dashboardRoute =
          userRole === 'teacher'
            ? '/teacher/dashboard'
            : userRole === 'student'
              ? '/student/dashboard'
              : '/auth';

        // Prevent navigation loop
        if (currentPath !== dashboardRoute) {
          hasNavigated.current = true;
          navigate(dashboardRoute, { replace: true });
        }
      }
    }
  }, [user, session, loading, requiredRole, navigate, redirectTo, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !session || (requiredRole && user.user_metadata?.role !== requiredRole)) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
