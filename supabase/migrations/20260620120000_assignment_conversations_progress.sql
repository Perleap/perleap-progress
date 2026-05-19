-- Track which `<assignment>` task indexes the student has demonstrably completed.
-- The perleap-chat Edge function builds a `<task_progress>` block in the system prompt from
-- this array, and the model emits a hidden `<<<PROGRESS:[indexes]>>>` line per turn that the
-- server unions into this column. Eliminates the "loop on a finished sub-task" + "stop too
-- early" failure modes.

ALTER TABLE assignment_conversations
  ADD COLUMN IF NOT EXISTS completed_task_indexes INT[] DEFAULT '{}'::int[];

NOTIFY pgrst, 'reload schema';
