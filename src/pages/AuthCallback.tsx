import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate('/auth');
          return;
        }

        // Check for pending role from localStorage (Google OAuth)
        const pendingRole = localStorage.getItem('pending_role');
        
        // Update user metadata if role is pending
        if (pendingRole && !user.user_metadata.role) {
          await supabase.auth.updateUser({
            data: { role: pendingRole }
          });
          localStorage.removeItem('pending_role');
        }

        const userRole = user.user_metadata.role || pendingRole;

        if (userRole === 'teacher') {
          const { data: profile } = await supabase
            .from('teacher_profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();
          
          if (!profile) {
            navigate('/onboarding/teacher');
          } else {
            navigate('/teacher/dashboard');
          }
        } else if (userRole === 'student') {
          const { data: profile } = await supabase
            .from('student_profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();
          
          if (!profile) {
            navigate('/onboarding/student');
          } else {
            navigate('/student/dashboard');
          }
        } else {
          // No role set, redirect to auth to select role
          navigate('/auth');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/auth');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;