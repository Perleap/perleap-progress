-- PostgREST was returning PGRST202 for the 4-arg RPC despite migration applied.
-- Expose a single jsonb-arg wrapper (PostgREST explicitly suggests this fallback in PGRST202 details).

CREATE OR REPLACE FUNCTION public.report_assignment_chat_sentence_impl(
  p_submission_id uuid,
  p_message_index integer,
  p_sentence_index integer,
  p_sentence_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_student_id uuid;
  v_assignment_id uuid;
  v_teacher_id uuid;
  v_messages jsonb;
  v_elem jsonb;
  v_role text;
  v_content text;
  v_sentences text[];
  v_sl int;
  v_expected text;
  v_flag_id uuid;
  v_student_name text;
  v_title text := 'Student flagged a chat sentence';
  v_snippet text;
  v_msg_body text;
  v_link text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT s.student_id, s.assignment_id, c.teacher_id
  INTO v_student_id, v_assignment_id, v_teacher_id
  FROM public.submissions s
  JOIN public.assignments a ON a.id = s.assignment_id
  JOIN public.classrooms c ON c.id = a.classroom_id
  WHERE s.id = p_submission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'submission_not_found');
  END IF;

  IF v_student_id <> (SELECT auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_submission_owner');
  END IF;

  SELECT ac.messages
  INTO v_messages
  FROM public.assignment_conversations ac
  WHERE ac.submission_id = p_submission_id;

  IF v_messages IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_conversation');
  END IF;

  IF p_message_index < 0 OR p_message_index >= jsonb_array_length(v_messages) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_message_index');
  END IF;

  v_elem := v_messages -> p_message_index;
  v_role := v_elem ->> 'role';
  IF v_role IS DISTINCT FROM 'assistant' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_assistant_message');
  END IF;

  v_content := trim(both from coalesce(v_elem ->> 'content', ''));
  v_sentences := public.split_assistant_message_into_sentences(v_content);
  v_sl := coalesce(array_length(v_sentences, 1), 0);

  IF v_sl = 0 OR p_sentence_index < 0 OR p_sentence_index >= v_sl THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_sentence_index');
  END IF;

  v_expected := trim(both from v_sentences[p_sentence_index + 1]);
  IF v_expected <> trim(both from coalesce(p_sentence_text, '')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sentence_mismatch');
  END IF;

  v_flag_id := NULL;
  INSERT INTO public.assignment_chat_sentence_flags (
    submission_id,
    assignment_id,
    student_id,
    message_index,
    sentence_index,
    sentence_text
  )
  VALUES (
    p_submission_id,
    v_assignment_id,
    v_student_id,
    p_message_index,
    p_sentence_index,
    trim(both from p_sentence_text)
  )
  ON CONFLICT ON CONSTRAINT assignment_chat_sentence_flags_sub_msg_sentence_uq
  DO NOTHING
  RETURNING id INTO v_flag_id;

  IF v_flag_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'duplicate', true);
  END IF;

  SELECT sp.full_name
  INTO v_student_name
  FROM public.student_profiles sp
  WHERE sp.user_id = v_student_id
  LIMIT 1;

  v_snippet := trim(both from coalesce(p_sentence_text, ''));
  v_msg_body := coalesce(left(v_snippet, 200), '');
  IF char_length(v_snippet) > 200 THEN
    v_msg_body := v_msg_body || '…';
  END IF;

  v_link := '/teacher/submission/' || p_submission_id::text;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    link,
    metadata,
    actor_id,
    is_read
  )
  VALUES (
    v_teacher_id,
    'ai_chat_sentence_flagged',
    v_title,
    CASE
      WHEN v_student_name IS NOT NULL AND trim(both from v_student_name) <> ''
      THEN trim(both from v_student_name) || ': ' || v_msg_body
      ELSE v_msg_body
    END,
    v_link,
    jsonb_build_object(
      'submission_id', p_submission_id,
      'assignment_id', v_assignment_id,
      'student_id', v_student_id,
      'message_index', p_message_index,
      'sentence_index', p_sentence_index
    ),
    v_student_id,
    false
  );

  RETURN jsonb_build_object('ok', true, 'flag_id', v_flag_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.report_assignment_chat_sentence(args jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.report_assignment_chat_sentence_impl(
    (args->>'p_submission_id')::uuid,
    (args->>'p_message_index')::integer,
    (args->>'p_sentence_index')::integer,
    coalesce(args->>'p_sentence_text', '')
  );
$$;

DROP FUNCTION IF EXISTS public.report_assignment_chat_sentence(uuid, integer, integer, text);

COMMENT ON FUNCTION public.report_assignment_chat_sentence(jsonb) IS
  'Student flags one assistant sentence (jsonb wrapper for PostgREST).';

COMMENT ON FUNCTION public.report_assignment_chat_sentence_impl(uuid, integer, integer, text) IS
  'Implementation for report_assignment_chat_sentence.';

GRANT EXECUTE ON FUNCTION public.report_assignment_chat_sentence(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
