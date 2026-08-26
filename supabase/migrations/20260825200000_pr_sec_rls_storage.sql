-- PR-SEC-RLS: tighten storage bucket access for submission, course, assignment, and live session media.

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
    WHERE (
        s.id = (split_part(object_name, '/', 1))::uuid
        OR (
          split_part(object_name, '/', 2) <> ''
          AND s.id = (split_part(object_name, '/', 2))::uuid
        )
      )
      AND (
        s.student_id = user_id
        OR c.teacher_id = user_id
        OR public.is_app_admin(user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_teacher_materials_folder(object_name text, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (storage.foldername(object_name))[1] = user_id::text
    OR EXISTS (
      SELECT 1
      FROM public.enrollments e
      JOIN public.classrooms c ON c.id = e.classroom_id
      WHERE e.student_id = user_id
        AND e.active = true
        AND c.teacher_id::text = (storage.foldername(object_name))[1]
    )
    OR public.is_app_admin(user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_access_live_session_storage(object_name text, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.live_sessions ls
    WHERE ls.id = (split_part(object_name, '/', 1))::uuid
      AND (
        public.is_classroom_teacher(ls.classroom_id, user_id)
        OR public.is_app_admin(user_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_submission_storage(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_teacher_materials_folder(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_live_session_storage(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_access_submission_storage(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_teacher_materials_folder(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_live_session_storage(text, uuid) TO authenticated;

-- submission-files: private bucket, owner + assignment teacher (+ admin)
UPDATE storage.buckets SET public = false WHERE id = 'submission-files';

DROP POLICY IF EXISTS "Students can upload submission files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view submission files" ON storage.objects;

CREATE POLICY "Submission owners and teachers can upload submission files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'submission-files'
  AND public.can_access_submission_storage(name, auth.uid())
);

CREATE POLICY "Submission owners and teachers can view submission files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'submission-files'
  AND public.can_access_submission_storage(name, auth.uid())
);

CREATE POLICY "Submission owners and teachers can update submission files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'submission-files'
  AND public.can_access_submission_storage(name, auth.uid())
)
WITH CHECK (
  bucket_id = 'submission-files'
  AND public.can_access_submission_storage(name, auth.uid())
);

CREATE POLICY "Submission owners and teachers can delete submission files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'submission-files'
  AND public.can_access_submission_storage(name, auth.uid())
);

-- course-materials: private; teacher folder owner or enrolled student of that teacher
UPDATE storage.buckets SET public = false WHERE id = 'course-materials';

DROP POLICY IF EXISTS "Public Access to Course Materials" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view their course materials" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload course materials" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can update course materials" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete course materials" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete their course materials" ON storage.objects;
DROP POLICY IF EXISTS "Teachers and enrolled students can view course materials" ON storage.objects;

CREATE POLICY "Teachers and enrolled students can view course materials"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-materials'
  AND public.can_access_teacher_materials_folder(name, auth.uid())
);

CREATE POLICY "Teachers can upload course materials"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Teachers can update course materials"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'course-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Teachers can delete course materials"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- assignment-materials: private; teacher owner folder or enrolled student of teacher
UPDATE storage.buckets SET public = false WHERE id = 'assignment-materials';

DROP POLICY IF EXISTS "Teachers can upload assignment materials" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view their assignment materials" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete their assignment materials" ON storage.objects;
DROP POLICY IF EXISTS "Teachers and enrolled students can view assignment materials" ON storage.objects;

CREATE POLICY "Teachers and enrolled students can view assignment materials"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-materials'
  AND public.can_access_teacher_materials_folder(name, auth.uid())
);

-- live session buckets: classroom teachers (+ admin) only
DROP POLICY IF EXISTS "Authenticated manage live session temp objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated manage live session audio objects" ON storage.objects;

CREATE POLICY "Classroom teachers manage live session temp objects"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'live-session-temp'
  AND public.can_access_live_session_storage(name, auth.uid())
)
WITH CHECK (
  bucket_id = 'live-session-temp'
  AND public.can_access_live_session_storage(name, auth.uid())
);

CREATE POLICY "Classroom teachers manage live session audio objects"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'live-session-audio'
  AND public.can_access_live_session_storage(name, auth.uid())
)
WITH CHECK (
  bucket_id = 'live-session-audio'
  AND public.can_access_live_session_storage(name, auth.uid())
);
