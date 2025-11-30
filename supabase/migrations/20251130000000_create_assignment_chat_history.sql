-- Create assignment_chat_history table for storing chat messages between students and AI teacher
CREATE TABLE IF NOT EXISTS assignment_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries by submission_id
CREATE INDEX IF NOT EXISTS idx_assignment_chat_history_submission_id 
  ON assignment_chat_history(submission_id);

-- Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_assignment_chat_history_user_id 
  ON assignment_chat_history(user_id);

-- Create index for ordering by created_at
CREATE INDEX IF NOT EXISTS idx_assignment_chat_history_created_at 
  ON assignment_chat_history(created_at);

-- Enable Row Level Security
ALTER TABLE assignment_chat_history ENABLE ROW LEVEL SECURITY;

-- Policy: Students can view their own chat history
CREATE POLICY "Students can view their own chat history"
  ON assignment_chat_history
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Policy: Students can insert their own messages
CREATE POLICY "Students can insert their own messages"
  ON assignment_chat_history
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- Policy: Teachers can view chat history for their assignments
CREATE POLICY "Teachers can view chat history for their assignments"
  ON assignment_chat_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM submissions sub
      JOIN assignments a ON a.id = sub.assignment_id
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE sub.id = assignment_chat_history.submission_id
        AND c.teacher_id = auth.uid()
    )
  );

-- Add comment to table
COMMENT ON TABLE assignment_chat_history IS 'Stores chat conversation history between students and AI teacher for assignments';
