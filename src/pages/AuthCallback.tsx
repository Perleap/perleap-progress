import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

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
        
        if (pendingRole && !user.user_metadata.role) {
          await supabase.auth.updateUser({
            data: { role: pendingRole }
          });
          localStorage.removeItem('pending_role');
        }

        const userRole = user.user_metadata.role || pendingRole;

        // Check if there's a saved redirect path
        const redirectPath = sessionStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          navigate(redirectPath);
          return;
        }

        // Redirect based on role and profile completion
        if (userRole === 'teacher' || userRole === 'student') {
          const tableName = `${userRole}_profiles`;
          const { data: profile } = await supabase
            .from(tableName)
            .select('id')
            .eq('user_id', user.id)
            .single();
          
          const destination = profile 
            ? `/${userRole}/dashboard` 
            : `/onboarding/${userRole}`;
          
          navigate(destination);
        } else {
          navigate('/auth');
        }
      } catch (error) {
        navigate('/auth');
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