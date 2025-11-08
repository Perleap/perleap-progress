/**
 * Route Definitions
 * Centralized route paths and route builders
 */

export const ROUTES = {
  // Public Routes
  HOME: '/',
  AUTH: '/auth',
  LOGIN: '/login',
  REGISTER: '/register',
  AUTH_CALLBACK: '/auth/callback',
  PRICING: '/pricing',
  CONTACT: '/contact',
  ABOUT: '/about',

  // Onboarding Routes
  TEACHER_ONBOARDING: '/onboarding/teacher',
  STUDENT_ONBOARDING: '/onboarding/student',

  // Teacher Routes
  TEACHER_DASHBOARD: '/teacher/dashboard',
  TEACHER_CLASSROOM: '/teacher/classroom/:id',
  TEACHER_SUBMISSION: '/teacher/submission/:id',
  TEACHER_SETTINGS: '/teacher/settings',

  // Student Routes
  STUDENT_DASHBOARD: '/student/dashboard',
  STUDENT_CLASSROOM: '/student/classroom/:id',
  STUDENT_ASSIGNMENT: '/student/assignment/:id',
  STUDENT_SETTINGS: '/student/settings',

  // Error Routes
  NOT_FOUND: '*',
} as const;

/**
 * Route Builders
 * Helper functions to build routes with parameters
 */
export const buildRoute = {
  teacherClassroom: (id: string) => `/teacher/classroom/${id}`,
  teacherSubmission: (id: string) => `/teacher/submission/${id}`,
  studentClassroom: (id: string) => `/student/classroom/${id}`,
  studentAssignment: (id: string) => `/student/assignment/${id}`,
} as const;

/**
 * Check if current path matches a route pattern
 */
export const matchesRoute = (currentPath: string, routePattern: string): boolean => {
  const regex = new RegExp('^' + routePattern.replace(/:\w+/g, '[^/]+') + '$');
  return regex.test(currentPath);
};

