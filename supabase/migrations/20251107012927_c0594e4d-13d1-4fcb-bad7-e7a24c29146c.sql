-- Add submission_id to five_d_snapshots to enable filtering by assignment
ALTER TABLE five_d_snapshots
ADD COLUMN submission_id uuid REFERENCES submissions(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_five_d_snapshots_submission_id ON five_d_snapshots(submission_id);

COMMENT ON COLUMN five_d_snapshots.submission_id IS 'Links the snapshot to a specific submission for assignment-based filtering';