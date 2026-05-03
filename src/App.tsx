import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
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
import AdminMonitoringLayout from './pages/admin/monitoring/AdminMonitoringLayout';
import MonitoringOverviewPage from './pages/admin/monitoring/MonitoringOverviewPage';
import MonitoringLogsPage from './pages/admin/monitoring/MonitoringLogsPage';
import MonitoringHealthPage from './pages/admin/monitoring/MonitoringHealthPage';
import MonitoringTrafficPage from './pages/admin/monitoring/MonitoringTrafficPage';
import AdminAiPromptsPage from './pages/admin/AdminAiPromptsPage';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentClassroomDetail from './pages/student/StudentClassroomDetail';
import AssignmentDetail from './pages/student/AssignmentDetail';
import StudentSettings from './pages/student/StudentSettings';
import ClassroomActivityPage from './pages/ClassroomActivityPage';
import Pricing from './pages/Pricing';
import ContactUs from './pages/ContactUs';
import AboutUs from './pages/AboutUs';
import Product from './pages/Product';
import Solutions from './pages/Solutions';
import NotFound from './pages/NotFound';
import { TeacherAssistantProvider } from './components/ai/TeacherAssistant';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent refetching when tabbing back to the app
      staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
      gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
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
              <TeacherAssistantProvider>
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
                  path="/teacher/classroom/:classroomId/try/assignment/:assignmentId"
                  element={
                    <ProtectedRoute requiredRole="teacher">
                      <AssignmentDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teacher/classroom/:classroomId/try/activity/:resourceId"
                  element={
                    <ProtectedRoute requiredRole="teacher">
                      <ClassroomActivityPage role="teacher" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teacher/classroom/:id/activity/:resourceId"
                  element={
                    <ProtectedRoute requiredRole="teacher">
                      <ClassroomActivityPage role="teacher" />
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
                <Route path="/teacher/monitoring" element={<Navigate to="/admin/monitoring" replace />} />

                <Route
                  path="/admin/monitoring"
                  element={
                    <ProtectedRoute requireAppAdmin>
                      <AdminMonitoringLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<MonitoringOverviewPage />} />
                  <Route path="logs" element={<MonitoringLogsPage />} />
                  <Route path="health" element={<MonitoringHealthPage />} />
                  <Route path="traffic" element={<MonitoringTrafficPage />} />
                </Route>

                <Route
                  path="/admin/ai-prompts"
                  element={
                    <ProtectedRoute requireAppAdmin>
                      <AdminMonitoringLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminAiPromptsPage />} />
                </Route>

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
                  path="/student/classroom/:id/activity/:resourceId"
                  element={
                    <ProtectedRoute requiredRole="student">
                      <ClassroomActivityPage role="student" />
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
              </TeacherAssistantProvider>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
