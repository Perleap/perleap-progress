-- Cached AI-generated pilot report snapshots per classroom scope + language.
-- Writes from teacher client; reads for instant pilot report page load.

CREATE TABLE IF NOT EXISTS public.pilot_report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  scope_module text NOT NULL DEFAULT 'all',
  scope_assignment text NOT NULL DEFAULT 'all',
  language text NOT NULL CHECK (language IN ('en', 'he')),
  data_hash text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
  participant_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  cohort_summary jsonb,
  error_message text,
  started_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, scope_module, scope_assignment, language)
);

CREATE INDEX IF NOT EXISTS pilot_report_snapshots_classroom_id_idx
  ON public.pilot_report_snapshots (classroom_id);

CREATE INDEX IF NOT EXISTS pilot_report_snapshots_status_idx
  ON public.pilot_report_snapshots (classroom_id, status);

CREATE OR REPLACE FUNCTION public.set_pilot_report_snapshots_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pilot_report_snapshots_updated_at ON public.pilot_report_snapshots;
CREATE TRIGGER pilot_report_snapshots_updated_at
  BEFORE UPDATE ON public.pilot_report_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pilot_report_snapshots_updated_at();

ALTER TABLE public.pilot_report_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pilot_report_snapshots_select_teacher"
  ON public.pilot_report_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = pilot_report_snapshots.classroom_id
        AND c.teacher_id = (SELECT auth.uid())
    )
    OR public.is_app_admin((SELECT auth.uid()))
  );

CREATE POLICY "pilot_report_snapshots_insert_teacher"
  ON public.pilot_report_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = pilot_report_snapshots.classroom_id
        AND c.teacher_id = (SELECT auth.uid())
    )
    OR public.is_app_admin((SELECT auth.uid()))
  );

CREATE POLICY "pilot_report_snapshots_update_teacher"
  ON public.pilot_report_snapshots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = pilot_report_snapshots.classroom_id
        AND c.teacher_id = (SELECT auth.uid())
    )
    OR public.is_app_admin((SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = pilot_report_snapshots.classroom_id
        AND c.teacher_id = (SELECT auth.uid())
    )
    OR public.is_app_admin((SELECT auth.uid()))
  );

CREATE POLICY "pilot_report_snapshots_delete_teacher"
  ON public.pilot_report_snapshots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = pilot_report_snapshots.classroom_id
        AND c.teacher_id = (SELECT auth.uid())
    )
    OR public.is_app_admin((SELECT auth.uid()))
  );

COMMENT ON TABLE public.pilot_report_snapshots IS
  'Cached pilot report AI assessments per classroom filter scope; invalidated via data_hash.';
