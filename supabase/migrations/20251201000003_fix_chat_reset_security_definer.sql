-- Update function to run with SECURITY DEFINER to bypass RLS policies
-- This is required because Teachers (who trigger this function via update)
-- do not have permission to DELETE rows in assignment_conversations (owned by Students)

CREATE OR REPLACE FUNCTION clear_conversations_on_assignment_update()
RETURNS TRIGGER
SECURITY DEFINER -- Run as superuser to bypass RLS
SET search_path = public -- Secure search_path
AS $$
BEGIN
  -- Only clear if instructions were actually changed
  IF OLD.instructions IS DISTINCT FROM NEW.instructions THEN
    -- Delete all conversations for submissions related to this assignment
    DELETE FROM assignment_conversations
    WHERE submission_id IN (
      SELECT id FROM submissions WHERE assignment_id = NEW.id
    );
    
    RAISE NOTICE 'Cleared conversations for assignment % due to instructions update', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create comment to reflect update
COMMENT ON FUNCTION clear_conversations_on_assignment_update() IS 'Clears student conversations when assignment instructions are modified. Runs as SECURITY DEFINER to bypass RLS.';

