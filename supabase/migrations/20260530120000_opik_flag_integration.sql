-- Opik flag integration: trace id storage + teacher content flags

ALTER TABLE public.assignment_feedback
  ADD COLUMN IF NOT EXISTS opik_trace_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.assignment_feedback.opik_trace_ids IS
  'Opik trace UUIDs keyed by generation step, e.g. feedback_main, hard_skills.';

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS opik_trace_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.assignments.opik_trace_ids IS
  'Opik trace UUIDs keyed by field, e.g. student_facing_task, instructions.';

CREATE TABLE IF NOT EXISTS public.ai_teacher_content_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  flagger_id uuid NOT NULL,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (
    content_type IN (
      'student_feedback',
      'teacher_feedback',
      'student_facing_task',
      'instructions'
    )
  ),
  content_excerpt text,
  opik_trace_id uuid,
  CONSTRAINT ai_teacher_content_flags_uq
    UNIQUE NULLS NOT DISTINCT (flagger_id, assignment_id, submission_id, content_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_teacher_content_flags_assignment
  ON public.ai_teacher_content_flags (assignment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_teacher_content_flags_submission
  ON public.ai_teacher_content_flags (submission_id, created_at DESC);

ALTER TABLE public.ai_teacher_content_flags ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.ai_teacher_content_flags FROM anon, authenticated;
GRANT SELECT ON public.ai_teacher_content_flags TO authenticated;

DROP POLICY IF EXISTS "ai_teacher_content_flags_select_teacher"
  ON public.ai_teacher_content_flags;
CREATE POLICY "ai_teacher_content_flags_select_teacher"
  ON public.ai_teacher_content_flags
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR (
      assignment_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.assignments a
        JOIN public.classrooms c ON c.id = a.classroom_id
        WHERE a.id = ai_teacher_content_flags.assignment_id
          AND c.teacher_id = (SELECT auth.uid())
      )
    )
    OR (
      submission_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        JOIN public.classrooms c ON c.id = a.classroom_id
        WHERE s.id = ai_teacher_content_flags.submission_id
          AND c.teacher_id = (SELECT auth.uid())
      )
    )
  );

CREATE OR REPLACE FUNCTION public.report_teacher_ai_content_flag_impl(
  p_assignment_id uuid,
  p_submission_id uuid,
  p_content_type text,
  p_content_excerpt text,
  p_opik_trace_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_teacher_id uuid;
  v_flag_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_content_type NOT IN (
    'student_feedback',
    'teacher_feedback',
    'student_facing_task',
    'instructions'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_content_type');
  END IF;

  IF p_submission_id IS NOT NULL THEN
    SELECT c.teacher_id
    INTO v_teacher_id
    FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    JOIN public.classrooms c ON c.id = a.classroom_id
    WHERE s.id = p_submission_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'submission_not_found');
    END IF;
  ELSIF p_assignment_id IS NOT NULL THEN
    SELECT c.teacher_id
    INTO v_teacher_id
    FROM public.assignments a
    JOIN public.classrooms c ON c.id = a.classroom_id
    WHERE a.id = p_assignment_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'assignment_not_found');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'missing_resource');
  END IF;

  IF v_teacher_id <> (SELECT auth.uid())
     AND NOT public.is_app_admin((SELECT auth.uid())) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_classroom_teacher');
  END IF;

  v_flag_id := NULL;
  INSERT INTO public.ai_teacher_content_flags (
    flagger_id,
    assignment_id,
    submission_id,
    content_type,
    content_excerpt,
    opik_trace_id
  )
  VALUES (
    (SELECT auth.uid()),
    p_assignment_id,
    p_submission_id,
    p_content_type,
    NULLIF(trim(both from coalesce(p_content_excerpt, '')), ''),
    p_opik_trace_id
  )
  ON CONFLICT ON CONSTRAINT ai_teacher_content_flags_uq
  DO NOTHING
  RETURNING id INTO v_flag_id;

  IF v_flag_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'duplicate', true);
  END IF;

  RETURN jsonb_build_object('ok', true, 'flag_id', v_flag_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.report_teacher_ai_content_flag(args jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.report_teacher_ai_content_flag_impl(
    NULLIF(args->>'p_assignment_id', '')::uuid,
    NULLIF(args->>'p_submission_id', '')::uuid,
    coalesce(args->>'p_content_type', ''),
    coalesce(args->>'p_content_excerpt', ''),
    NULLIF(args->>'p_opik_trace_id', '')::uuid
  );
$$;

COMMENT ON FUNCTION public.report_teacher_ai_content_flag(jsonb) IS
  'Teacher flags AI-generated content (jsonb wrapper for PostgREST).';

GRANT EXECUTE ON FUNCTION public.report_teacher_ai_content_flag(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
