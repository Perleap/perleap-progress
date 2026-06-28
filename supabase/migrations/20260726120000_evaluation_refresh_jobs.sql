-- Background jobs for classroom evaluation refresh (progress polling + cancel)

CREATE TABLE IF NOT EXISTS public.evaluation_refresh_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('running', 'cancelled', 'completed', 'failed')),
  total_students int NOT NULL DEFAULT 0,
  completed_students int NOT NULL DEFAULT 0,
  total_submissions int NOT NULL DEFAULT 0,
  batch_id uuid REFERENCES public.evaluation_refresh_batches(id) ON DELETE SET NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluation_refresh_jobs_classroom_running
  ON public.evaluation_refresh_jobs (classroom_id)
  WHERE status = 'running';

COMMENT ON TABLE public.evaluation_refresh_jobs IS
  'In-flight and recent classroom AI evaluation refresh jobs for progress polling and cancel.';

ALTER TABLE public.evaluation_refresh_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evaluation_refresh_jobs_select" ON public.evaluation_refresh_jobs;
CREATE POLICY "evaluation_refresh_jobs_select" ON public.evaluation_refresh_jobs
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = evaluation_refresh_jobs.classroom_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "evaluation_refresh_jobs_all_service" ON public.evaluation_refresh_jobs;
CREATE POLICY "evaluation_refresh_jobs_all_service" ON public.evaluation_refresh_jobs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.increment_evaluation_refresh_completed_students(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.evaluation_refresh_jobs
  SET completed_students = completed_students + 1
  WHERE id = p_job_id AND status = 'running';
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_evaluation_refresh_completed_students(uuid) TO service_role;
