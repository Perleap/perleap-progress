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

        // Check for pending role from localStorage (Google OAuth)
        const pendingRole = localStorage.getItem('pending_role');

        if (pendingRole && !user.user_metadata.role) {
          await supabase.auth.updateUser({
            data: { role: pendingRole },
          });
          localStorage.removeItem('pending_role');
        }

        let userRole = user.user_metadata.role || pendingRole;
        console.log('🎭 AuthCallback: Initial role:', userRole);

        // If no role in metadata or localStorage, check database for existing profiles
        if (!userRole) {
          console.log('🔍 AuthCallback: No role found, checking database profiles...');
          
          // Check if user has a teacher profile
          const { data: teacherProfile, error: teacherError } = await supabase
            .from('teacher_profiles')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          console.log('👨‍🏫 AuthCallback: Teacher profile check:', { 
            found: !!teacherProfile, 
            error: teacherError?.message 
          });

          if (teacherProfile) {
            userRole = 'teacher';
            console.log('✅ AuthCallback: Found teacher profile, updating user metadata');
            // Update user metadata with the role
            await supabase.auth.updateUser({
              data: { role: 'teacher' },
            });
          } else {
            // Check if user has a student profile
            const { data: studentProfile, error: studentError } = await supabase
              .from('student_profiles')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();

            console.log('👨‍🎓 AuthCallback: Student profile check:', { 
              found: !!studentProfile, 
              error: studentError?.message 
            });

            if (studentProfile) {
              userRole = 'student';
              console.log('✅ AuthCallback: Found student profile, updating user metadata');
              // Update user metadata with the role
              await supabase.auth.updateUser({
                data: { role: 'student' },
              });
            }
          }
        }

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
