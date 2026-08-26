-- Fix submission storage path parsing: 3-segment paths are {assignmentId}/{submissionId}/{file}.
-- Prior COALESCE preferred segment 1 (assignment id), blocking project/presentation access.

CREATE OR REPLACE FUNCTION public.can_access_submission_storage(object_name text, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    JOIN public.classrooms c ON c.id = a.classroom_id
    WHERE s.id = (
      CASE
        WHEN split_part(object_name, '/', 3) <> ''
          AND split_part(object_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (split_part(object_name, '/', 2))::uuid
        WHEN split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (split_part(object_name, '/', 1))::uuid
        ELSE NULL
      END
    )
    AND (
      s.student_id = user_id
      OR c.teacher_id = user_id
      OR public.is_app_admin(user_id)
    )
  );
$$;
