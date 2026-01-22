import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/layouts/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/layouts/Footer";
import { ScrollHighlightText } from "@/components/landing/ScrollHighlightText";
import { FlowChart } from "@/components/landing/FlowChart";
import { Customers } from "@/components/landing/Customers";
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const Landing = () => {
  const { t } = useTranslation();
  const { user, loading: authLoading, hasProfile, isProfileLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if we're in the middle of an OAuth callback or email confirmation
  const isOAuthCallback = searchParams.has('code') || 
                           searchParams.has('access_token') || 
                           searchParams.has('error') || 
                           searchParams.has('type');

  // If we detect OAuth or email callback parameters on the landing page,
  // redirect to the dedicated callback handler
  useEffect(() => {
    if (isOAuthCallback) {
      console.log('🔄 Landing: OAuth callback detected, redirecting to /auth/callback');
      navigate(`/auth/callback${window.location.search}`, { replace: true });
    }
  }, [isOAuthCallback, navigate]);

  // Check if user is already authenticated and redirect
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      // Don't redirect if we're already handling a callback
      if (isOAuthCallback) return;

      // Wait for auth loading and profile loading
      if (authLoading || isProfileLoading) return;
      // If user is logged in but profile check is not done, wait
      if (user && hasProfile === null) return;

      if (user) {
        console.log('🔍 Landing: Checking authenticated user profile status...');

        const userRole = user.user_metadata?.role;

        // Check if user has completed their profile
        if (userRole === 'teacher' || userRole === 'student') {
          // Use cached profile check from AuthContext
          if (hasProfile === false) {
            console.log(`⚠️ Landing: User has ${userRole} role but no profile, redirecting to onboarding`);
            navigate(`/onboarding/${userRole}`, { replace: true });
            return;
          }
        }

        // Check if there's a saved redirect path
        const redirectPath = sessionStorage.getItem('redirectAfterLogin');

        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          navigate(redirectPath);
          return;
        }

        // Otherwise, redirect to appropriate dashboard based on role
        if (userRole === 'teacher') {
          console.log('🚀 Landing: Redirecting authenticated teacher to dashboard');
          navigate('/teacher/dashboard');
        } else if (userRole === 'student') {
          console.log('🚀 Landing: Redirecting authenticated student to dashboard');
          navigate('/student/dashboard');
        } else {
          // User is authenticated but has no role metadata
          console.log('⚠️ Landing: User has no role, redirecting to role selection');
          navigate('/role-selection', { replace: true });
        }
      }
    };

    checkAuthAndRedirect();
  }, [user?.id, authLoading, navigate, hasProfile, isProfileLoading, isOAuthCallback]);

  // If OAuth callback is in progress or user is already authenticated, show loading state
  // This prevents the Landing page from rendering and causing a flicker
  // CRITICAL: Added safety check for missing role to prevent infinite spinner
  const hasUserButNoRole = user && !user.user_metadata?.role;

  if (isOAuthCallback || (!authLoading && user && !hasUserButNoRole) || isProfileLoading || (user && hasProfile === null && !hasUserButNoRole)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('common.redirecting')}</p>
        </div>
      </div>
    );
  }

  // If user is logged in but has no role, redirect to role selection instead of showing spinner
  // Only do this if we are not currently handling a callback
  if (user && hasUserButNoRole && !authLoading && !isOAuthCallback) {
    console.log('⚠️ Landing: User has no role metadata, redirecting to role selection');
    navigate('/role-selection', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/10">
      <Navbar />
      <main>
        <Hero />
        <ScrollHighlightText
          text={t('landing.mission')}
          className="bg-background"
        />
        <FlowChart />
        <Features />
        <Customers />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
