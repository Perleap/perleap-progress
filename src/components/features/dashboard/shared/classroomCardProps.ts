export type StudentEnrolledClassroom = {
  id: string;
  name: string;
  subject: string;
  start_date?: string | null;
  end_date?: string | null;
  invite_code: string;
  teacher_profiles?: { full_name: string; avatar_url?: string } | null;
};
