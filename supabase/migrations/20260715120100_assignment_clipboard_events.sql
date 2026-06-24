-- Automatic copy/paste telemetry during student assignment work.

CREATE TYPE public.assignment_clipboard_event_type AS ENUM ('copy', 'paste');

CREATE TYPE public.assignment_clipboard_source_kind AS ENUM (
  'assistant_message',
  'user_message',
  'chat_input',
  'student_facing_task',
  'assignment_instructions',
  'essay',
  'test_answer',
  'langchain_field',
  'page_unknown'
);

CREATE TABLE public.assignment_clipboard_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  event_type public.assignment_clipboard_event_type NOT NULL,
  source_kind public.assignment_clipboard_source_kind NOT NULL,
  copied_text text,
  pasted_text text,
  message_index integer CHECK (message_index IS NULL OR message_index >= 0),
  sentence_index integer CHECK (sentence_index IS NULL OR sentence_index >= 0),
  sentence_text text,
  context_key text,
  linked_message_index integer CHECK (linked_message_index IS NULL OR linked_message_index >= 0),
  CONSTRAINT assignment_clipboard_events_text_check CHECK (
    (event_type = 'copy' AND copied_text IS NOT NULL AND trim(both from copied_text) <> '' AND pasted_text IS NULL)
    OR (event_type = 'paste' AND pasted_text IS NOT NULL AND trim(both from pasted_text) <> '' AND copied_text IS NULL)
  )
);

CREATE INDEX idx_assignment_clipboard_events_submission
  ON public.assignment_clipboard_events (submission_id, created_at ASC);

ALTER TABLE public.assignment_clipboard_events ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.assignment_clipboard_events FROM anon, authenticated;
GRANT SELECT ON public.assignment_clipboard_events TO authenticated;

CREATE POLICY "assignment_clipboard_events_select_student"
  ON public.assignment_clipboard_events
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()));

CREATE POLICY "assignment_clipboard_events_select_teacher"
  ON public.assignment_clipboard_events
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_clipboard_events.assignment_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.record_assignment_clipboard_event(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_student_id uuid;
  v_assignment_id uuid;
  v_event_type text;
  v_source_kind text;
  v_copied text;
  v_pasted text;
  v_message_index integer;
  v_sentence_index integer;
  v_sentence_text text;
  v_context_key text;
  v_linked_message_index integer;
  v_submission_id uuid;
  v_messages jsonb;
  v_elem jsonb;
  v_role text;
  v_content text;
  v_sentences text[];
  v_sl int;
  v_expected text;
  v_event_id uuid;
  v_max_len int := 10000;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  v_submission_id := (p_payload ->> 'submission_id')::uuid;
  IF v_submission_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_submission_id');
  END IF;

  SELECT s.student_id, s.assignment_id
  INTO v_student_id, v_assignment_id
  FROM public.submissions s
  WHERE s.id = v_submission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'submission_not_found');
  END IF;

  IF v_student_id <> (SELECT auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_submission_owner');
  END IF;

  v_event_type := nullif(trim(both from p_payload ->> 'event_type'), '');
  v_source_kind := nullif(trim(both from p_payload ->> 'source_kind'), '');

  IF v_event_type NOT IN ('copy', 'paste') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_event_type');
  END IF;

  IF v_source_kind IS NULL OR v_source_kind NOT IN (
    'assistant_message', 'user_message', 'chat_input', 'student_facing_task',
    'assignment_instructions', 'essay', 'test_answer', 'langchain_field', 'page_unknown'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_source_kind');
  END IF;

  v_copied := nullif(trim(both from coalesce(p_payload ->> 'copied_text', '')), '');
  v_pasted := nullif(trim(both from coalesce(p_payload ->> 'pasted_text', '')), '');

  IF v_event_type = 'copy' AND v_copied IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_copied_text');
  END IF;
  IF v_event_type = 'paste' AND v_pasted IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_pasted_text');
  END IF;

  IF v_event_type = 'copy' THEN
    IF char_length(v_copied) > v_max_len THEN
      v_copied := left(v_copied, v_max_len);
    END IF;
  ELSE
    IF char_length(v_pasted) > v_max_len THEN
      v_pasted := left(v_pasted, v_max_len);
    END IF;
  END IF;

  v_message_index := CASE
    WHEN p_payload ? 'message_index' AND (p_payload ->> 'message_index') IS NOT NULL
    THEN (p_payload ->> 'message_index')::integer
    ELSE NULL
  END;
  v_sentence_index := CASE
    WHEN p_payload ? 'sentence_index' AND (p_payload ->> 'sentence_index') IS NOT NULL
    THEN (p_payload ->> 'sentence_index')::integer
    ELSE NULL
  END;
  v_sentence_text := nullif(trim(both from coalesce(p_payload ->> 'sentence_text', '')), '');
  v_context_key := nullif(trim(both from coalesce(p_payload ->> 'context_key', '')), '');
  v_linked_message_index := CASE
    WHEN p_payload ? 'linked_message_index' AND (p_payload ->> 'linked_message_index') IS NOT NULL
    THEN (p_payload ->> 'linked_message_index')::integer
    ELSE NULL
  END;

  IF v_source_kind = 'assistant_message' AND v_event_type = 'copy'
     AND v_message_index IS NOT NULL AND v_sentence_index IS NOT NULL THEN
    SELECT ac.messages
    INTO v_messages
    FROM public.assignment_conversations ac
    WHERE ac.submission_id = v_submission_id;

    IF v_messages IS NOT NULL
       AND v_message_index >= 0
       AND v_message_index < jsonb_array_length(v_messages) THEN
      v_elem := v_messages -> v_message_index;
      v_role := v_elem ->> 'role';
      IF v_role = 'assistant' THEN
        v_content := trim(both from coalesce(v_elem ->> 'content', ''));
        v_sentences := public.split_assistant_message_into_sentences(v_content);
        v_sl := coalesce(array_length(v_sentences, 1), 0);
        IF v_sl > 0 AND v_sentence_index >= 0 AND v_sentence_index < v_sl THEN
          v_expected := trim(both from v_sentences[v_sentence_index + 1]);
          IF v_sentence_text IS NULL OR v_sentence_text = '' THEN
            v_sentence_text := v_expected;
          ELSIF v_sentence_text <> v_expected THEN
            v_sentence_text := v_expected;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.assignment_clipboard_events (
    submission_id,
    assignment_id,
    student_id,
    event_type,
    source_kind,
    copied_text,
    pasted_text,
    message_index,
    sentence_index,
    sentence_text,
    context_key,
    linked_message_index
  )
  VALUES (
    v_submission_id,
    v_assignment_id,
    v_student_id,
    v_event_type::public.assignment_clipboard_event_type,
    v_source_kind::public.assignment_clipboard_source_kind,
    CASE WHEN v_event_type = 'copy' THEN v_copied ELSE NULL END,
    CASE WHEN v_event_type = 'paste' THEN v_pasted ELSE NULL END,
    v_message_index,
    v_sentence_index,
    v_sentence_text,
    v_context_key,
    v_linked_message_index
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('ok', true, 'event_id', v_event_id);
END;
$$;

COMMENT ON FUNCTION public.record_assignment_clipboard_event(jsonb) IS
  'Student records a copy or paste event during assignment work; validates submission ownership.';

GRANT EXECUTE ON FUNCTION public.record_assignment_clipboard_event(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.link_assignment_clipboard_paste_messages(
  p_submission_id uuid,
  p_message_index integer,
  p_since timestamptz DEFAULT (now() - interval '5 minutes')
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_student_id uuid;
  v_updated int;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT s.student_id INTO v_student_id
  FROM public.submissions s
  WHERE s.id = p_submission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'submission_not_found');
  END IF;

  IF v_student_id <> (SELECT auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_submission_owner');
  END IF;

  IF p_message_index IS NULL OR p_message_index < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_message_index');
  END IF;

  UPDATE public.assignment_clipboard_events e
  SET linked_message_index = p_message_index
  WHERE e.submission_id = p_submission_id
    AND e.student_id = v_student_id
    AND e.event_type = 'paste'
    AND e.source_kind = 'chat_input'
    AND e.linked_message_index IS NULL
    AND e.created_at >= coalesce(p_since, now() - interval '5 minutes');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_assignment_clipboard_paste_messages(uuid, integer, timestamptz) TO authenticated;
