import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { legacySingleOptionId } from '@/lib/testMcq';

export const testKeys = {
  all: ['test'] as const,
  questions: (assignmentId: string, forStudent?: boolean) =>
    [...testKeys.all, 'questions', assignmentId, forStudent ? 'student' : 'full'] as const,
  responses: (submissionId: string) => [...testKeys.all, 'responses', submissionId] as const,
};

export type StudentTestQuestion = Pick<
  Tables<'test_questions'>,
  'id' | 'question_text' | 'question_type' | 'options' | 'order_index' | 'allow_multiple_selections'
>;

export function useTestQuestions(assignmentId: string | undefined) {
  return useQuery({
    queryKey: testKeys.questions(assignmentId!, false),
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('test_questions')
        .select('*')
        .eq('assignment_id', assignmentId!)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useStudentTestQuestions(assignmentId: string | undefined) {
  return useQuery({
    queryKey: testKeys.questions(assignmentId!, true),
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('test_questions')
        .select(
          'id, question_text, question_type, options, order_index, allow_multiple_selections',
        )
        .eq('assignment_id', assignmentId!)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useTestResponses(submissionId: string | undefined) {
  return useQuery({
    queryKey: testKeys.responses(submissionId!),
    enabled: !!submissionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('test_responses')
        .select('*')
        .eq('submission_id', submissionId!);

      if (error) throw error;
      return data;
    },
  });
}

export function useSubmitTestResponses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      submissionId,
      responses,
    }: {
      submissionId: string;
      responses: {
        question_id: string;
        selected_option_ids?: string[];
        text_answer?: string;
      }[];
    }) => {
      const rows = responses.map((r) => {
        const selected_option_ids = r.selected_option_ids ?? [];
        return {
          submission_id: submissionId,
          question_id: r.question_id,
          selected_option_ids,
          selected_option_id: legacySingleOptionId(selected_option_ids),
          text_answer: r.text_answer || null,
        };
      });

      const { data, error } = await supabase
        .from('test_responses')
        .upsert(rows, { onConflict: 'submission_id,question_id' })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: testKeys.responses(variables.submissionId),
      });
    },
  });
}
