/**
 * Query Hooks Index
 * Re-exports all React Query hooks for easy imports
 */

// Classroom Queries
export {
  classroomKeys,
  useClassrooms,
  useClassroom,
  useEnrolledStudents as useClassroomStudents,
  useClassroomByInviteCode,
  useCreateClassroom,
  useUpdateClassroom,
  useJoinClassroom,
} from './useClassroomQueries';

// Assignment Queries
export {
  assignmentKeys,
  useClassroomAssignments,
  useAssignment,
  useStudentAssignments,
  useCreateAssignment,
  useUpdateAssignment,
  useDeleteAssignment,
  useStudentAssignmentDetails,
} from './useAssignmentQueries';

// Submission Queries
export {
  submissionKeys,
  useSubmission,
  useSubmissionDetails,
  useClassroomSubmissions,
  useSubmissionFeedback,
  useCompleteSubmission,
  useSendChatMessage,
  useGenerateFeedback,
  useEnrichedClassroomSubmissions,
  useFullSubmissionDetails,
  useTeacherConversationMessages,
} from './useSubmissionQueries';

// Enrollment Queries
export {
  enrollmentKeys,
  useEnrolledStudents,
  useIsEnrolled,
  useEnrollInClassroom,
  useUnenrollFromClassroom,
} from './useEnrollmentQueries';

// Profile Queries
export {
  profileKeys,
  useTeacherProfile,
  useStudentProfile,
  useStudentProfileById,
  useUpdateTeacherProfile,
  useUpdateStudentProfile,
} from './useProfileQueries';

// Analytics Queries
export {
  analyticsKeys,
  useClassroomAnalytics,
} from './useAnalyticsQueries';

// Activity Queries
export {
  activityKeys,
  useRecentActivity,
} from './useActivityQueries';

// Calendar Queries
export {
  calendarKeys,
  useTeacherCalendarData,
  useStudentCalendarData,
} from './useCalendarQueries';

// Notification Queries
export {
  notificationKeys,
  useNotifications as useNotificationList,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from './useNotificationQueries';

// Test Queries
export {
  testKeys,
  useTestQuestions,
  useTestResponses,
  useSubmitTestResponses,
} from './useTestQueries';

// Nuance Queries
export {
  nuanceKeys,
  useNuanceInsights,
} from './useNuanceQueries';

export type {
  NuanceMetric,
  NuanceRecommendation,
  NuanceInsightsResponse,
} from './useNuanceQueries';

// Syllabus Queries
export {
  syllabusKeys,
  useSyllabus,
  useCreateSyllabus,
  useUpdateSyllabus,
  usePublishSyllabus,
  useArchiveSyllabus,
  useCreateSyllabusSection,
  useUpdateSyllabusSection,
  useDeleteSyllabusSection,
  useReorderSyllabusSections,
  useCreateGradingCategory,
  useUpdateGradingCategory,
  useDeleteGradingCategory,
  useLinkAssignment,
  useUnlinkAssignment,
} from './useSyllabusQueries';









