import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔄 AuthCallback: Starting authentication callback');
        
        const {
          data: { user },
        } = await supabase.auth.getUser();

        console.log('👤 AuthCallback: User data:', { 
          userId: user?.id, 
          email: user?.email,
          role: user?.user_metadata?.role 
        });

        if (!user) {
          console.log('❌ AuthCallback: No user found, redirecting to /auth');
          navigate('/auth');
          return;
        }

        // ALWAYS check for existing profiles first to prevent duplicate registrations
        console.log('🔍 AuthCallback: Checking for existing profiles...');
        
        // Check by user_id
        const { data: teacherProfile } = await supabase
          .from('teacher_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        // Also check by email (in case of data inconsistency)
        const userEmail = user.email?.toLowerCase().trim();
        let teacherProfileByEmail = null;
        let studentProfileByEmail = null;
        
        if (userEmail) {
          const { data: tpEmail } = await supabase
            .from('teacher_profiles')
            .select('id, email')
            .eq('email', userEmail)
            .maybeSingle();
          teacherProfileByEmail = tpEmail;

          const { data: spEmail } = await supabase
            .from('student_profiles')
            .select('id, email')
            .eq('email', userEmail)
            .maybeSingle();
          studentProfileByEmail = spEmail;
        }

        const hasTeacherProfile = teacherProfile || teacherProfileByEmail;
        const hasStudentProfile = studentProfile || studentProfileByEmail;

        console.log('👨‍🏫 AuthCallback: Existing profiles:', { 
          hasTeacherProfile: !!hasTeacherProfile, 
          hasStudentProfile: !!hasStudentProfile,
          userEmail 
        });

        let userRole = user.user_metadata.role;

        // If user already has a profile, use that role and prevent new registration
        if (hasTeacherProfile || hasStudentProfile) {
          const existingRole = hasTeacherProfile ? 'teacher' : 'student';
          console.log(`✅ AuthCallback: User has existing ${existingRole} profile`);
          
          // Update user metadata if it doesn't match
          if (userRole !== existingRole) {
            console.log(`🔄 AuthCallback: Updating user metadata to match existing profile: ${existingRole}`);
            await supabase.auth.updateUser({
              data: { role: existingRole },
            });
            userRole = existingRole;
          }

          // Clear any pending role since we're using the existing profile
          localStorage.removeItem('pending_role');
          
          // Redirect to the existing role's dashboard
          console.log(`🚀 AuthCallback: Redirecting to existing ${existingRole} dashboard`);
          navigate(`/${existingRole}/dashboard`, { replace: true });
          return;
        }

        // No existing profiles found - process new registration
        console.log('🆕 AuthCallback: No existing profiles, processing new registration');
        
        // Check for pending role from localStorage (Google OAuth)
        const pendingRole = localStorage.getItem('pending_role');

        if (pendingRole && !userRole) {
          console.log(`🎭 AuthCallback: Setting role from pending: ${pendingRole}`);
          await supabase.auth.updateUser({
            data: { role: pendingRole },
          });
          localStorage.removeItem('pending_role');
          userRole = pendingRole;
        }

        console.log('🎭 AuthCallback: Final role for new user:', userRole);

        // Check if there's a saved redirect path
        const redirectPath = sessionStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          navigate(redirectPath);
          return;
        }

        // Redirect based on role and profile completion
        if (userRole === 'teacher' || userRole === 'student') {
          console.log(`✅ AuthCallback: Role determined as ${userRole}, checking profile...`);
          
          const tableName = `${userRole}_profiles`;
          const { data: profile } = await supabase
            .from(tableName)
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          const destination = profile ? `/${userRole}/dashboard` : `/onboarding/${userRole}`;
          
          console.log(`🚀 AuthCallback: Redirecting to ${destination}`);
          navigate(destination, { replace: true });
        } else {
          // New user with no role - redirect to auth to select role
          console.log('⚠️ AuthCallback: No role determined, redirecting to /auth');
          navigate('/auth', { replace: true });
        }
      } catch (error) {
        console.error('❌ AuthCallback: Error during callback:', error);
        navigate('/auth', { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
