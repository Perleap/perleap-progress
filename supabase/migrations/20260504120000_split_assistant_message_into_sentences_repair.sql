-- Remote DB was missing split_assistant_message_into_sentences despite migration history;
-- fixes 42883 when report_assignment_chat_sentence_impl runs.
CREATE OR REPLACE FUNCTION public.split_assistant_message_into_sentences(p_text text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
DECLARE
  raw text := trim(both from coalesce(p_text, ''));
  out_arr text[] := ARRAY[]::text[];
  i int := 1;
  n int;
  j int;
  boundary int := -1;
  k int;
  ch text;
  sentence text;
  next_idx int;
BEGIN
  IF raw = '' THEN
    RETURN out_arr;
  END IF;

  n := char_length(raw);

  WHILE i <= n LOOP
    boundary := -1;
    FOR j IN i..n LOOP
      ch := substr(raw, j, 1);
      IF ch IN ('.', '!', '?', '׃') THEN
        k := j + 1;
        WHILE k <= n AND substr(raw, k, 1) IN ('.', '!', '?', '׃') LOOP
          k := k + 1;
        END LOOP;
        IF k > n THEN
          boundary := k - 1;
          EXIT;
        END IF;
        IF substr(raw, k, 1) ~ '^[[:space:]]$' THEN
          boundary := k - 1;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    IF boundary < 0 THEN
      sentence := trim(both from substr(raw, i, n - i + 1));
      IF sentence <> '' THEN
        out_arr := array_append(out_arr, sentence);
      END IF;
      EXIT;
    END IF;

    sentence := trim(both from substr(raw, i, boundary - i + 1));
    IF sentence <> '' THEN
      out_arr := array_append(out_arr, sentence);
    END IF;

    next_idx := boundary + 1;
    WHILE next_idx <= n AND substr(raw, next_idx, 1) ~ '^[[:space:]]$' LOOP
      next_idx := next_idx + 1;
    END LOOP;
    i := next_idx;
  END LOOP;

  RETURN out_arr;
END;
$$;

COMMENT ON FUNCTION public.split_assistant_message_into_sentences(text) IS
  'Mirror of TS splitAssistantMessageIntoSentences (src/lib/chatDisplay.ts).';

NOTIFY pgrst, 'reload schema';
