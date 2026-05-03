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
  prefetchClassroomAssignments,
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
  useTeacherChatSentenceFlags,
} from './useSubmissionQueries';

// Enrollment Queries
export {
  enrollmentKeys,
  prefetchEnrolledStudentsList,
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
export {
  analytics5dNarrativeKeys,
  useAnalytics5dNarrative,
} from './useAnalytics5dNarrative';

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
  useNuanceUnderstandingCueEvents,
} from './useNuanceQueries';

export type {
  NuanceMetric,
  NuanceRecommendation,
  NuanceInsightsResponse,
  NuanceUnderstandingCueEventRow,
} from './useNuanceQueries';

// Syllabus Queries
export {
  syllabusKeys,
  prefetchSyllabusByClassroom,
  prefetchSyllabusOutlineByClassroom,
  useSyllabus,
  useSyllabusOutlineForClassroom,
  useCreateSyllabus,
  useProvisionSyllabusBundle,
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
  resourceKeys,
  resourceByIdKeys,
  useSectionResources,
  useSectionResourceById,
  useUploadResource,
  useCreateLinkResource,
  useDeleteResource,
  useCreateTextActivity,
  useCreateLessonActivity,
  useUpdateSectionResource,
  useCreateVideoUrlResource,
  progressKeys,
  useStudentProgress,
  useUpdateStudentProgress,
  changelogKeys,
  useChangelog,
  useCreateChangelog,
  commentKeys,
  useSectionComments,
  useCreateComment,
  useDeleteComment,
  sectionAssignmentKeys,
  useSectionAssignments,
  sectionProgressKeys,
  useSectionAssignmentProgress,
} from './useSyllabusQueries';

export {
  moduleFlowKeys,
  studentFlowProgressKeys,
  assignmentSubmittedFlagsKeys,
  assignmentFlowCompleteKeys,
  useModuleFlowSteps,
  useModuleFlowStepsBulk,
  useReplaceModuleFlow,
  useStudentCurriculumFlowContext,
  useStudentModuleFlowProgressMap,
  useAssignmentFlowProgressMaps,
  useAssignmentCompletedMap,
  useAssignmentSubmittedOrCompletedMap,
  useMarkFlowStepComplete,
  useAssignmentFlowCompletion,
} from './useModuleFlowQueries';

export { syncModuleFlowToResolvedDisplayForSection } from './moduleFlowSync';









