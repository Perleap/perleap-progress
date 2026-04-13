-- Snapshot author display fields on section_comments (RLS blocks cross-student profile reads).
ALTER TABLE public.section_comments
  ADD COLUMN IF NOT EXISTS author_display_name text,
  ADD COLUMN IF NOT EXISTS author_avatar_url text;

CREATE OR REPLACE FUNCTION public.section_comments_set_author_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_avatar text;
BEGIN
  SELECT sp.full_name, sp.avatar_url INTO v_name, v_avatar
  FROM public.student_profiles sp
  WHERE sp.user_id = NEW.user_id
  LIMIT 1;

  IF v_name IS NULL THEN
    SELECT tp.full_name, tp.avatar_url INTO v_name, v_avatar
    FROM public.teacher_profiles tp
    WHERE tp.user_id = NEW.user_id
    LIMIT 1;
  END IF;

  NEW.author_display_name := COALESCE(v_name, 'User');
  NEW.author_avatar_url := v_avatar;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS section_comments_set_author ON public.section_comments;
CREATE TRIGGER section_comments_set_author
  BEFORE INSERT ON public.section_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.section_comments_set_author_fields();

-- Backfill existing rows (migration runs with privileges that bypass RLS).
UPDATE public.section_comments sc
SET
  author_display_name = p.full_name,
  author_avatar_url = p.avatar_url
FROM (
  SELECT
    sc_inner.id,
    COALESCE(sp.full_name, tp.full_name, 'User') AS full_name,
    COALESCE(sp.avatar_url, tp.avatar_url) AS avatar_url
  FROM public.section_comments sc_inner
  LEFT JOIN public.student_profiles sp ON sp.user_id = sc_inner.user_id
  LEFT JOIN public.teacher_profiles tp ON tp.user_id = sc_inner.user_id
) AS p
WHERE sc.id = p.id
  AND (sc.author_display_name IS NULL OR sc.author_display_name = '');

COMMENT ON COLUMN public.section_comments.author_display_name IS
  'Display name at comment time; set by trigger from student/teacher profile.';
COMMENT ON COLUMN public.section_comments.author_avatar_url IS
  'Avatar URL at comment time; set by trigger from student/teacher profile.';
