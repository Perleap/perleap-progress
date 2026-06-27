-- Structured QED Development / Motivation / Phase / Next per 5D dimension

ALTER TABLE public.five_d_snapshots
  ADD COLUMN IF NOT EXISTS qed_measures jsonb;

COMMENT ON COLUMN public.five_d_snapshots.qed_measures IS
  'Per-dimension QED measures: development (1-100), motivation (1-100), phase (up|down), next (text). Keys: vision, values, thinking, connection, action.';
