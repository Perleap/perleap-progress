import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import AuthCallback from './pages/AuthCallback';
import TeacherOnboarding from './pages/onboarding/TeacherOnboarding';
import StudentOnboarding from './pages/onboarding/StudentOnboarding';
import RoleSelection from './pages/RoleSelection';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import ClassroomDetail from './pages/teacher/ClassroomDetail';
import SubmissionDetail from './pages/teacher/SubmissionDetail';
import TeacherSettings from './pages/teacher/TeacherSettings';
import Planner from './pages/teacher/Planner';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentClassroomDetail from './pages/student/StudentClassroomDetail';
import AssignmentDetail from './pages/student/AssignmentDetail';
import StudentSettings from './pages/student/StudentSettings';
import Pricing from './pages/Pricing';
import ContactUs from './pages/ContactUs';
import AboutUs from './pages/AboutUs';
import Product from './pages/Product';
import Solutions from './pages/Solutions';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent refetching when tabbing back to the app
      refetchOnMount: false, // Prevent refetching on component mount if data exists
      refetchOnReconnect: false, // Prevent refetching on internet reconnect
      retry: 1, // Only retry failed requests once
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <LanguageProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/product" element={<Product />} />
                <Route path="/solutions" element={<Solutions />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/register" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/role-selection" element={<RoleSelection />} />
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
                <Route
                  path="/teacher/planner"
                  element={
                    <ProtectedRoute requiredRole="teacher">
                      <Planner />
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
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
