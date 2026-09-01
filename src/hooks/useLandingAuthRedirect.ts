import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import {
  clearAccountJustDeletedSessionFlag,
  isAccountJustDeletedSessionFlagSet,
} from '@/utils/accountDeletionRedirect';

export function useLandingAuthRedirect() {
  const { user, loading: authLoading, hasProfile, isProfileLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isOAuthCallback =
    searchParams.has('code') ||
    searchParams.has('access_token') ||
    searchParams.has('error') ||
    searchParams.has('type');

  const hasUserButNoRole = Boolean(user && !user.user_metadata?.role);

  useEffect(() => {
    if (isOAuthCallback) {
      navigate(`/auth/callback${window.location.search}`, { replace: true });
    }
  }, [isOAuthCallback, navigate]);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      if (isOAuthCallback) return;

      if (isAccountJustDeletedSessionFlagSet()) {
        if (!authLoading && !user) {
          clearAccountJustDeletedSessionFlag();
        } else {
          return;
        }
      }

      if (authLoading || isProfileLoading) return;
      if (user && hasProfile === null) return;

      if (user) {
        const userRole = user.user_metadata?.role;

        if (userRole === 'teacher' || userRole === 'student') {
          if (hasProfile === false) {
            navigate(`/onboarding/${userRole}`, { replace: true });
            return;
          }
        }

        const redirectPath = sessionStorage.getItem('redirectAfterLogin');

        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          navigate(redirectPath);
          return;
        }

        if (userRole === 'teacher' || userRole === 'admin') {
          navigate('/teacher/dashboard');
        } else if (userRole === 'student') {
          navigate('/student/dashboard');
        } else {
          navigate('/role-selection', { replace: true });
        }
      }
    };

    void checkAuthAndRedirect();
  }, [user, authLoading, navigate, hasProfile, isProfileLoading, isOAuthCallback]);

  useEffect(() => {
    if (user && hasUserButNoRole && !authLoading && !isOAuthCallback) {
      navigate('/role-selection', { replace: true });
    }
  }, [user, hasUserButNoRole, authLoading, isOAuthCallback, navigate]);

  const isRedirecting =
    isOAuthCallback ||
    (!authLoading && Boolean(user) && !hasUserButNoRole) ||
    isProfileLoading ||
    (Boolean(user) && hasProfile === null && !hasUserButNoRole) ||
    (Boolean(user) && hasUserButNoRole && !authLoading && !isOAuthCallback);

  return {
    isRedirecting,
    shouldRenderLanding: !isRedirecting,
  };
}
