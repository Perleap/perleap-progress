-- PR-SEC-RLS: private syllabus-resources bucket; classroom teacher or enrolled student access.

CREATE OR REPLACE FUNCTION public.can_access_syllabus_resource_storage(object_name text, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.syllabus_sections ss
    JOIN public.syllabi y ON y.id = ss.syllabus_id
    WHERE ss.id::text = (storage.foldername(object_name))[1]
      AND (
        public.is_classroom_teacher(y.classroom_id, user_id)
        OR EXISTS (
          SELECT 1
          FROM public.enrollments e
          WHERE e.classroom_id = y.classroom_id
            AND e.student_id = user_id
            AND e.active = true
        )
        OR public.is_app_admin(user_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_syllabus_resource_storage(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_syllabus_resource_storage(text, uuid) TO authenticated;

UPDATE storage.buckets SET public = false WHERE id = 'syllabus-resources';

DROP POLICY IF EXISTS "Public read syllabus resources" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload syllabus section resources" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete syllabus section resources" ON storage.objects;
DROP POLICY IF EXISTS "Teachers and enrolled students can view syllabus resources" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can update syllabus section resources" ON storage.objects;

CREATE POLICY "Teachers and enrolled students can view syllabus resources"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'syllabus-resources'
  AND public.can_access_syllabus_resource_storage(name, auth.uid())
);

CREATE POLICY "Teachers can upload syllabus section resources"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'syllabus-resources'
  AND EXISTS (
    SELECT 1
    FROM public.syllabus_sections ss
    JOIN public.syllabi y ON y.id = ss.syllabus_id
    WHERE ss.id::text = (storage.foldername(name))[1]
      AND public.is_classroom_teacher(y.classroom_id, (SELECT auth.uid()))
  )
);

CREATE POLICY "Teachers can update syllabus section resources"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'syllabus-resources'
  AND EXISTS (
    SELECT 1
    FROM public.syllabus_sections ss
    JOIN public.syllabi y ON y.id = ss.syllabus_id
    WHERE ss.id::text = (storage.foldername(name))[1]
      AND public.is_classroom_teacher(y.classroom_id, (SELECT auth.uid()))
  )
)
WITH CHECK (
  bucket_id = 'syllabus-resources'
  AND EXISTS (
    SELECT 1
    FROM public.syllabus_sections ss
    JOIN public.syllabi y ON y.id = ss.syllabus_id
    WHERE ss.id::text = (storage.foldername(name))[1]
      AND public.is_classroom_teacher(y.classroom_id, (SELECT auth.uid()))
  )
);

CREATE POLICY "Teachers can delete syllabus section resources"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'syllabus-resources'
  AND EXISTS (
    SELECT 1
    FROM public.syllabus_sections ss
    JOIN public.syllabi y ON y.id = ss.syllabus_id
    WHERE ss.id::text = (storage.foldername(name))[1]
      AND public.is_classroom_teacher(y.classroom_id, (SELECT auth.uid()))
  )
);
