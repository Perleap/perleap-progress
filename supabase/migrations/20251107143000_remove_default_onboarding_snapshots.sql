-- Remove all existing 5D snapshots that were created during onboarding
-- Students will now only get 5D values after completing assessments

DELETE FROM public.five_d_snapshots
WHERE source = 'onboarding';

-- Add comment to document the change
COMMENT ON TABLE public.five_d_snapshots IS 'Stores student 5D assessment snapshots. Students only get values after completing assignments, not during onboarding.';

