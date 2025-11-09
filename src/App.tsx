import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import TeacherOnboarding from "./pages/onboarding/TeacherOnboarding";
import StudentOnboarding from "./pages/onboarding/StudentOnboarding";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import ClassroomDetail from "./pages/teacher/ClassroomDetail";
import SubmissionDetail from "./pages/teacher/SubmissionDetail";
import TeacherSettings from "./pages/teacher/TeacherSettings";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentClassroomDetail from "./pages/student/StudentClassroomDetail";
import AssignmentDetail from "./pages/student/AssignmentDetail";
import StudentSettings from "./pages/student/StudentSettings";
import Pricing from "./pages/Pricing";
import ContactUs from "./pages/ContactUs";
import AboutUs from "./pages/AboutUs";
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
            <Route path="/login" element={<Auth />} />
            <Route path="/register" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/about" element={<AboutUs />} />
            
            {/* Protected onboarding routes - require authentication */}
            <Route 
              path="/onboarding/teacher" 
              element={
                <ProtectedRoute requiredRole="teacher">
                  <TeacherOnboarding />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/onboarding/student" 
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentOnboarding />
                </ProtectedRoute>
              } 
            />
            
            {/* Protected teacher routes */}
            <Route 
              path="/teacher/dashboard" 
              element={
                <ProtectedRoute requiredRole="teacher">
                  <TeacherDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/teacher/classroom/:id" 
              element={
                <ProtectedRoute requiredRole="teacher">
                  <ClassroomDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/teacher/submission/:id" 
              element={
                <ProtectedRoute requiredRole="teacher">
                  <SubmissionDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/teacher/settings" 
              element={
                <ProtectedRoute requiredRole="teacher">
                  <TeacherSettings />
                </ProtectedRoute>
              } 
            />
            
            {/* Protected student routes */}
            <Route 
              path="/student/dashboard" 
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/classroom/:id" 
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentClassroomDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/assignment/:id" 
              element={
                <ProtectedRoute requiredRole="student">
                  <AssignmentDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/settings" 
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentSettings />
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
