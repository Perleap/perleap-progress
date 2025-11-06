import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import TeacherOnboarding from "./pages/onboarding/TeacherOnboarding";
import StudentOnboarding from "./pages/onboarding/StudentOnboarding";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import ClassroomDetail from "./pages/teacher/ClassroomDetail";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentClassroomDetail from "./pages/student/StudentClassroomDetail";
import AssignmentDetail from "./pages/student/AssignmentDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/onboarding/teacher" element={<TeacherOnboarding />} />
            <Route path="/onboarding/student" element={<StudentOnboarding />} />
            <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
            <Route path="/teacher/classroom/:id" element={<ClassroomDetail />} />
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/student/classroom/:id" element={<StudentClassroomDetail />} />
            <Route path="/student/assignment/:id" element={<AssignmentDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
