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
        
        // Check by user_id - THIS IS THE SOURCE OF TRUTH
        const { data: teacherProfile } = await supabase
          .from('teacher_profiles')
          .select('id, user_id, email')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('id, user_id, email')
          .eq('user_id', user.id)
          .maybeSingle();

        // Also check by email to detect orphaned data or conflicts
        const userEmail = user.email?.toLowerCase().trim();
        let teacherProfileByEmail = null;
        let studentProfileByEmail = null;
        
        if (userEmail) {
          const { data: tpEmail } = await supabase
            .from('teacher_profiles')
            .select('id, user_id, email')
            .eq('email', userEmail)
            .maybeSingle();
          teacherProfileByEmail = tpEmail;

          const { data: spEmail } = await supabase
            .from('student_profiles')
            .select('id, user_id, email')
            .eq('email', userEmail)
            .maybeSingle();
          studentProfileByEmail = spEmail;
        }

        // IMPORTANT: Only trust profiles that match the current user_id
        // Profiles found by email with different user_id are orphaned data
        const hasTeacherProfile = !!teacherProfile;
        const hasStudentProfile = !!studentProfile;

        console.log('👨‍🏫 AuthCallback: Profile check results:', { 
          hasTeacherProfile,
          hasStudentProfile,
          teacherProfileUserId: teacherProfile?.user_id,
          studentProfileUserId: studentProfile?.user_id,
          currentUserId: user.id,
          userEmail,
          orphanedTeacherProfile: teacherProfileByEmail && teacherProfileByEmail.user_id !== user.id,
          orphanedStudentProfile: studentProfileByEmail && studentProfileByEmail.user_id !== user.id,
        });

        // Detect and CLEAN UP orphaned profiles immediately
        if (teacherProfileByEmail && teacherProfileByEmail.user_id !== user.id) {
          console.warn('⚠️ AuthCallback: Found orphaned teacher_profile with email', userEmail, 
            'but different user_id. Cleaning up now...');
          // Delete the orphaned profile by its user_id (which doesn't exist in auth anymore)
          const { error: deleteError } = await supabase
            .from('teacher_profiles')
            .delete()
            .eq('user_id', teacherProfileByEmail.user_id);
          if (!deleteError) {
            console.log('✅ Orphaned teacher profile deleted');
          }
        }
        if (studentProfileByEmail && studentProfileByEmail.user_id !== user.id) {
          console.warn('⚠️ AuthCallback: Found orphaned student_profile with email', userEmail, 
            'but different user_id. Cleaning up now...');
          // Delete the orphaned profile by its user_id (which doesn't exist in auth anymore)
          const { error: deleteError } = await supabase
            .from('student_profiles')
            .delete()
            .eq('user_id', studentProfileByEmail.user_id);
          if (!deleteError) {
            console.log('✅ Orphaned student profile deleted');
          }
        }

        let userRole = user.user_metadata.role;

        // If user already has a profile (matching current user_id), use that role
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
          
          // Check for profile existence using explicit table names for TypeScript
          let profile = null;
          let profileError = null;
          
          if (userRole === 'teacher') {
            const result = await supabase
              .from('teacher_profiles')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();
            profile = result.data;
            profileError = result.error;
          } else {
            const result = await supabase
              .from('student_profiles')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();
            profile = result.data;
            profileError = result.error;
          }

          if (profileError) {
            console.error('❌ AuthCallback: Error checking profile:', profileError);
          }

          const destination = profile ? `/${userRole}/dashboard` : `/onboarding/${userRole}`;
          
          console.log(`🚀 AuthCallback: ${profile ? 'Profile exists' : 'No profile found'}, redirecting to ${destination}`);
          navigate(destination, { replace: true });
        } else {
          // New user with no role - redirect to auth to select role
          console.log('⚠️ AuthCallback: No role determined, redirecting to /auth to select role');
          // Store a flag to indicate the user needs to complete registration
          sessionStorage.setItem('needsRoleSelection', 'true');
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
