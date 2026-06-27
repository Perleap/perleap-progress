import { Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import { RouteLoadingFallback } from './components/common/RouteLoadingFallback';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import AuthCallback from './pages/AuthCallback';
import {
  AboutUs,
  AdminAiPromptsPage,
  AdminMonitoringLayout,
  AssignmentDetail,
  ClassroomActivityPage,
  ClassroomDetail,
  ContactUs,
  LessonBriefPage,
  LiveSessionPage,
  MonitoringHealthPage,
  MonitoringLogsPage,
  MonitoringOverviewPage,
  MonitoringTrafficPage,
  NotFound,
  PilotReportPage,
  Planner,
  Pricing,
  Product,
  RoleSelection,
  Solutions,
  StudentClassroomDetail,
  StudentDashboard,
  StudentOnboarding,
  StudentSettings,
  SubmissionDetail,
  TeacherDashboard,
  TeacherOnboarding,
  TeacherSettings,
} from './routes/lazyPages';
import { TeacherAssistantProvider } from './components/ai/TeacherAssistant';
import { LiveSessionProcessingProvider } from './contexts/LiveSessionProcessingContext';
import { EvaluationRefreshProcessingProvider } from './contexts/EvaluationRefreshProcessingContext';

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
              <LiveSessionProcessingProvider>
              <EvaluationRefreshProcessingProvider>
              <Suspense fallback={<RouteLoadingFallback />}>
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
                  path="/teacher/classroom/:id/lesson-brief"
                  element={
                    <ProtectedRoute requiredRole="teacher">
                      <LessonBriefPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teacher/classroom/:id/pilot-report"
                  element={
                    <ProtectedRoute requiredRole="teacher">
                      <PilotReportPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teacher/classroom/:id/live-session/:assignmentId"
                  element={
                    <ProtectedRoute requiredRole="teacher">
                      <LiveSessionPage />
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
              </Suspense>
              </EvaluationRefreshProcessingProvider>
              </LiveSessionProcessingProvider>
              </TeacherAssistantProvider>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
