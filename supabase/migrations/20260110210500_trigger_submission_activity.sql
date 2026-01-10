-- Create a function to log submission activity
CREATE OR REPLACE FUNCTION log_submission_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_teacher_id uuid;
  v_assignment_title text;
  v_student_name text;
  v_classroom_id uuid;
BEGIN
  -- Only log if status changed to 'completed' or is inserted as 'completed'
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
     
    -- Get assignment details (title and classroom's teacher_id)
    SELECT a.title, a.classroom_id, c.teacher_id 
    INTO v_assignment_title, v_classroom_id, v_teacher_id
    FROM assignments a
    JOIN classrooms c ON a.classroom_id = c.id
    WHERE a.id = NEW.assignment_id;
    
    -- Get student name
    SELECT full_name INTO v_student_name
    FROM student_profiles
    WHERE user_id = NEW.student_id;
    
    -- Insert activity event
    -- Use SECURITY DEFINER privilege of the function to bypass RLS for this insert
    INSERT INTO activity_events (
      teacher_id, 
      type, 
      entity_type, 
      entity_id, 
      title, 
      route
    ) VALUES (
      v_teacher_id,
      'create', -- Treat a completed submission as a 'creation' of a submission event
      'submission',
      NEW.id,
      coalesce(v_student_name, 'Student') || ' submitted ' || coalesce(v_assignment_title, 'Assignment'),
      '/teacher/classroom/' || v_classroom_id || '/assignment/' || NEW.assignment_id || '/submissions'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function after insert or update on submissions
DROP TRIGGER IF EXISTS on_submission_completed ON submissions;
CREATE TRIGGER on_submission_completed
  AFTER INSERT OR UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION log_submission_activity();
