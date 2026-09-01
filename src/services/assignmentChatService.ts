import { supabase } from '@/integrations/supabase/client';

export async function checkIsAppAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_app_admin', { _user_id: userId });
  if (error) throw error;
  return data === true;
}

export async function uploadChatAttachmentToStorage(
  submissionId: string,
  file: File
): Promise<{ filePath: string; isImage: boolean; safeName: string }> {
  const safeName = file.name?.trim() || `pasted-${Date.now()}.bin`;
  const filePath = `${submissionId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from('submission-files')
    .upload(filePath, file, { upsert: true });
  if (error) throw error;
  return { filePath, isImage: file.type.startsWith('image/'), safeName };
}

export async function fetchConversationMessages(submissionId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('assignment_conversations')
    .select('messages')
    .eq('submission_id', submissionId)
    .maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.messages) ? data.messages : [];
}

export type ReportChatSentenceResult = { ok?: boolean; duplicate?: boolean; error?: string };

export async function reportAssignmentChatSentence(args: {
  submissionId: string;
  messageIndex: number;
  sentenceIndex: number;
  sentenceText: string;
}): Promise<ReportChatSentenceResult> {
  const { data, error } = await supabase.rpc('report_assignment_chat_sentence', {
    args: {
      p_submission_id: args.submissionId,
      p_message_index: args.messageIndex,
      p_sentence_index: args.sentenceIndex,
      p_sentence_text: args.sentenceText,
    },
  });
  if (error) throw error;
  return (data ?? {}) as ReportChatSentenceResult;
}
