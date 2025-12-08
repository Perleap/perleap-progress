import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Check if user is already authenticated and redirect
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      if (!authLoading && user) {
        console.log('🔍 Landing: Checking authenticated user profile status...');

        const userRole = user.user_metadata?.role;

        // Check if user has completed their profile
        if (userRole === 'teacher' || userRole === 'student') {
          const profileTable = userRole === 'teacher' ? 'teacher_profiles' : 'student_profiles';
          const { data: profile } = await supabase
            .from(profileTable)
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!profile) {
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
        }
      }
    };

    checkAuthAndRedirect();
  }, [user?.id, authLoading, navigate]);

  // If user is already authenticated and auth is not loading, show loading state
  // This prevents the Landing page from rendering and causing a flicker
  if (!authLoading && user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('common.redirecting')}</p>
        </div>
      </div>
    );
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
