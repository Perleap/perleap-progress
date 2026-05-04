-- Recent activity: use teacher name (or "Teacher") when submission is a teacher preview attempt.

CREATE OR REPLACE FUNCTION public.log_submission_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_teacher_id uuid;
  v_assignment_title text;
  v_submitter_name text;
  v_classroom_id uuid;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN

    SELECT a.title, a.classroom_id, c.teacher_id
    INTO v_assignment_title, v_classroom_id, v_teacher_id
    FROM public.assignments a
    JOIN public.classrooms c ON a.classroom_id = c.id
    WHERE a.id = NEW.assignment_id;

    IF COALESCE(NEW.is_teacher_attempt, false) THEN
      SELECT full_name INTO v_submitter_name
      FROM public.teacher_profiles
      WHERE user_id = NEW.student_id;
      v_submitter_name := coalesce(v_submitter_name, 'Teacher');
    ELSE
      SELECT full_name INTO v_submitter_name
      FROM public.student_profiles
      WHERE user_id = NEW.student_id;
      v_submitter_name := coalesce(v_submitter_name, 'Student');
    END IF;

    INSERT INTO public.activity_events (
      teacher_id,
      type,
      entity_type,
      entity_id,
      title,
      route
    ) VALUES (
      v_teacher_id,
      'create',
      'submission',
      NEW.id,
      v_submitter_name || ' submitted ' || coalesce(v_assignment_title, 'Assignment'),
      '/teacher/submission/' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
