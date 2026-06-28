-- Add in-tab inactivity events for Nuance time-away tracking.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'nuance_event_type'
      AND e.enumlabel = 'in_tab_idle_start'
  ) THEN
    ALTER TYPE public.nuance_event_type ADD VALUE 'in_tab_idle_start';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'nuance_event_type'
      AND e.enumlabel = 'in_tab_idle_end'
  ) THEN
    ALTER TYPE public.nuance_event_type ADD VALUE 'in_tab_idle_end';
  END IF;
END;
$migration$;
