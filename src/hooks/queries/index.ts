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
  useUpdateTeacherProfile,
  useUpdateStudentProfile,
} from './useProfileQueries';








