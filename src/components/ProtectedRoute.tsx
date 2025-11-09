import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "teacher" | "student";
  redirectTo?: string;
}

const ProtectedRoute = ({ children, requiredRole, redirectTo = "/auth" }: ProtectedRouteProps) => {
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    // Redirect to auth if not authenticated
    if (!user || !session) {
      const currentPath = window.location.pathname;
      if (currentPath !== redirectTo) {
        sessionStorage.setItem('redirectAfterLogin', currentPath);
      }
      navigate(redirectTo);
      return;
    }

    // Check role-based access
    if (requiredRole) {
      const userRole = user.user_metadata?.role;
      
      if (userRole !== requiredRole) {
        const dashboardRoute = userRole === 'teacher' 
          ? '/teacher/dashboard' 
          : userRole === 'student' 
          ? '/student/dashboard' 
          : '/auth';
        
        navigate(dashboardRoute);
      }
    }
  }, [user, session, loading, requiredRole, navigate, redirectTo]);

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
