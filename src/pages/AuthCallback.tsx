import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import {
  attemptRoleRecovery,
  getPendingRole,
  updateUserRole,
  clearPendingRole,
} from '@/utils/roleRecovery';
import { isSignupInProgress } from '@/utils/sessionState';
import { USER_ROLES } from '@/config/constants';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Safety timeout: if callback takes more than 20 seconds, force redirect to login
    const timeout = setTimeout(() => {
      console.warn('⚠️ AuthCallback: Operation timed out, redirecting to /auth');
      navigate('/auth', { replace: true });
    }, 20000);

    const handleCallback = async () => {
      try {
        console.log('🔄 AuthCallback: Starting authentication callback');

        // Do NOT call exchangeCodeForSession here: createClient already has detectSessionInUrl + PKCE,
        // so the code verifier is consumed on first URL handling. A second exchange causes:
        // "both auth code and code verifier should be non-empty".
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          console.log('❌ AuthCallback: No session, redirecting to /auth');
          clearTimeout(timeout);
          navigate('/auth', { replace: true });
          return;
        }

        const user = session.user;

        console.log('👤 AuthCallback: User data:', {
          userId: user.id,
          email: user.email,
          role: user.user_metadata?.role,
        });

        // ALWAYS check for existing profiles first to prevent duplicate registrations
        console.log('🔍 AuthCallback: Checking for existing profiles...');

        // Check by user_id - THIS IS THE SOURCE OF TRUTH
        const { data: teacherProfile, error: tError } = await supabase
          .from('teacher_profiles')
          .select('id, user_id, email')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: studentProfile, error: sError } = await supabase
          .from('student_profiles')
          .select('id, user_id, email')
          .eq('user_id', user.id)
          .maybeSingle();

        if (tError) console.error('Error fetching teacher profile:', tError);
        if (sError) console.error('Error fetching student profile:', sError);

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

        const { data: appAdminRow } = await supabase
          .from('app_admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (appAdminRow) {
          if (user.user_metadata?.role !== USER_ROLES.ADMIN) {
            await updateUserRole(USER_ROLES.ADMIN);
          }
          clearTimeout(timeout);
          navigate('/teacher/dashboard', { replace: true });
          return;
        }

        if (user.user_metadata?.role === USER_ROLES.ADMIN) {
          clearTimeout(timeout);
          navigate('/teacher/dashboard', { replace: true });
          return;
        }

        console.log('👨‍🏫 AuthCallback: Profile check results:', {
          hasTeacherProfile,
          hasStudentProfile,
          teacherProfileUserId: teacherProfile?.user_id,
          studentProfileUserId: studentProfile?.user_id,
          currentUserId: user.id,
          userEmail,
          orphanedTeacherProfile:
            teacherProfileByEmail && teacherProfileByEmail.user_id !== user.id,
          orphanedStudentProfile:
            studentProfileByEmail && studentProfileByEmail.user_id !== user.id,
        });

        // Detect and CLEAN UP orphaned profiles immediately
        // Note: Wrapped in try-catch to prevent blocking the main flow if RLS or other errors occur
        try {
          if (teacherProfileByEmail && teacherProfileByEmail.user_id !== user.id) {
            console.warn(
              '⚠️ AuthCallback: Found orphaned teacher_profile with email',
              userEmail,
              'but different user_id. Attempting cleanup...'
            );
            await supabase
              .from('teacher_profiles')
              .delete()
              .eq('user_id', teacherProfileByEmail.user_id);
          }
          if (studentProfileByEmail && studentProfileByEmail.user_id !== user.id) {
            console.warn(
              '⚠️ AuthCallback: Found orphaned student_profile with email',
              userEmail,
              'but different user_id. Attempting cleanup...'
            );
            await supabase
              .from('student_profiles')
              .delete()
              .eq('user_id', studentProfileByEmail.user_id);
          }
        } catch (cleanupError) {
          console.error(
            '⚠️ AuthCallback: Non-blocking error during orphaned data cleanup:',
            cleanupError
          );
        }

        let userRole = user.user_metadata?.role;

        // If user already has a profile (matching current user_id), use that role
        if (hasTeacherProfile || hasStudentProfile) {
          const existingRole = hasTeacherProfile ? 'teacher' : 'student';
          console.log(`✅ AuthCallback: User has existing ${existingRole} profile`);

          // Update user metadata if it doesn't match
          if (userRole !== existingRole) {
            console.log(
              `🔄 AuthCallback: Updating user metadata to match existing profile: ${existingRole}`
            );
            await supabase.auth.updateUser({
              data: { role: existingRole },
            });
            userRole = existingRole;
          }

          // Clear any pending role since we're using the existing profile
          localStorage.removeItem('pending_role');

          // Redirect to the existing role's dashboard
          console.log(`🚀 AuthCallback: Redirecting to existing ${existingRole} dashboard`);
          clearTimeout(timeout);
          navigate(`/${existingRole}/dashboard`, { replace: true });
          return;
        }

        // No existing profiles found - process new registration
        console.log('🆕 AuthCallback: No existing profiles, processing new registration');

        // Check if this is an active signup or a recovery situation
        const activelySigningUp = isSignupInProgress();

        if (
          !userRole ||
          (userRole !== 'teacher' && userRole !== 'student' && userRole !== USER_ROLES.ADMIN)
        ) {
          // CRITICAL: Different behavior for active signup vs recovery
          if (activelySigningUp) {
            console.log('🔄 AuthCallback: Active signup - attempting quick recovery');

            // Try to recover from localStorage (backup from Auth.tsx)
            const pendingRole = getPendingRole();

            if (pendingRole && (pendingRole === 'teacher' || pendingRole === 'student')) {
              console.log(`🔄 AuthCallback: Found pending role: ${pendingRole}`);
              const updated = await updateUserRole(pendingRole as 'teacher' | 'student');

              if (updated) {
                console.log('✅ AuthCallback: Role set from pending');
                clearPendingRole();
                userRole = pendingRole;
              }
            }
          } else {
            // NOT actively signing up - this is a recovery situation
            console.warn('⚠️ AuthCallback: User has no valid role (not during active signup)');

            const { recovered, role, source } = await attemptRoleRecovery();

            if (recovered && role) {
              console.log(`✅ AuthCallback: Role recovered from ${source}: ${role}`);
              userRole = role;
            }
          }
        }

        console.log('🎭 AuthCallback: Final role for new user:', userRole);

        // If still no role, redirect to role selection page
        if (
          !userRole ||
          (userRole !== 'teacher' && userRole !== 'student' && userRole !== USER_ROLES.ADMIN)
        ) {
          console.warn('⚠️ AuthCallback: Cannot determine role, redirecting to role selection');
          clearTimeout(timeout);
          navigate('/role-selection', { replace: true });
          return;
        }

        // Check if there's a saved redirect path
        const redirectPath = sessionStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          clearTimeout(timeout);
          navigate(redirectPath);
          return;
        }

        // Redirect based on role and profile completion
        if (userRole === USER_ROLES.ADMIN) {
          clearTimeout(timeout);
          navigate('/teacher/dashboard', { replace: true });
          return;
        }

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

          console.log(
            `🚀 AuthCallback: ${profile ? 'Profile exists' : 'No profile found'}, redirecting to ${destination}`
          );
          clearTimeout(timeout);
          navigate(destination, { replace: true });
        } else {
          // New user with no role - redirect to auth to select role
          console.log('⚠️ AuthCallback: No role determined, redirecting to /auth to select role');
          // Store a flag to indicate the user needs to complete registration
          sessionStorage.setItem('needsRoleSelection', 'true');
          clearTimeout(timeout);
          navigate('/auth', { replace: true });
        }
      } catch (error) {
        console.error('❌ AuthCallback: Error during callback:', error);
        clearTimeout(timeout);
        navigate('/auth', { replace: true });
      }
    };

    handleCallback();

    return () => clearTimeout(timeout);
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
