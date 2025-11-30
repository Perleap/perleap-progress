-- Clear student conversations when assignment instructions are updated
-- This forces regeneration of AI greeting with new instructions

-- Create function to clear conversations when assignment is updated
CREATE OR REPLACE FUNCTION clear_conversations_on_assignment_update()
RETURNS TRIGGER AS $$
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

-- Create trigger on assignments table
DROP TRIGGER IF EXISTS trigger_clear_conversations_on_assignment_update ON assignments;

CREATE TRIGGER trigger_clear_conversations_on_assignment_update
  AFTER UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION clear_conversations_on_assignment_update();

-- Add comment
COMMENT ON FUNCTION clear_conversations_on_assignment_update() IS 'Clears student conversations when assignment instructions are modified to force regeneration with new content';

