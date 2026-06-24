/**
 * Conversation Hook
 * Custom hook for managing assignment conversations
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/api/client';
import { streamChatMessage } from '@/services';
import type { Message, ApiError, ChatRequest, ChatDebugPayload, InitialGreetingMode } from '@/types';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAssignmentLanguage } from '@/utils/languageDetection';
import { rehydrateMessages } from '@/lib/conversationMessages';
import { hasConversationCompleteMarker } from '@/lib/chatDisplay';
import { areAllParsedTasksComplete, resolveAssignmentTutorText } from '@/lib/assignmentTasks';

interface UseConversationResult {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  error: ApiError | null;
  conversationEnded: boolean;
  language: string;
  lastAssistantDebug: ChatDebugPayload | null;
  sendMessage: (content: string, fileContext?: { name: string; content: string; url?: string; type?: string }) => Promise<void>;
  initializeConversation: (mode?: InitialGreetingMode) => Promise<void>;
}

interface UseConversationParams {
  submissionId: string;
  /** Used only for local language detection (`getAssignmentLanguage`); never sent on the chat API. */
  assignmentInstructions: string;
  /** Prefer over instructions when inferring task progress on reload. */
  studentFacingTask?: string | null;
  assignmentId: string;
  priorSubmissionIds?: string[];
  /** When true, AI "conversation complete" does not lock the chat or drive assignment submission. */
  companionMode?: boolean;
  /** App admins only; server verifies `is_app_admin` before returning debug payloads. */
  debugChat?: boolean;
  /** When false, empty conversations are not auto-started until `autoInitialize` becomes true. */
  autoInitialize?: boolean;
  /** First greeting mode when auto-initializing (e.g. after task-understanding confirmation). */
  initialGreetingMode?: InitialGreetingMode;
  /** Lighter tutoring on follow-up turns after task-explanation overview. */
  postExplainTutoring?: boolean;
}

/**
 * Hook to manage assignment conversation state
 */
export const useConversation = ({
  submissionId,
  assignmentInstructions,
  studentFacingTask,
  assignmentId,
  priorSubmissionIds,
  companionMode = false,
  debugChat = false,
  autoInitialize = true,
  initialGreetingMode = 'default',
  postExplainTutoring = false,
}: UseConversationParams): UseConversationResult => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationEnded, setConversationEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastAssistantDebug, setLastAssistantDebug] = useState<ChatDebugPayload | null>(null);
  const hasLoadedSubmission = useRef(false);
  const loadCompletedRef = useRef(false);
  const initInFlightRef = useRef(false);
  const initScheduledRef = useRef(false);
  /** Bumped on submission change / unmount so stale stream callbacks are ignored. */
  const streamGenerationRef = useRef(0);
  const autoInitializeRef = useRef(autoInitialize);
  const initialGreetingModeRef = useRef(initialGreetingMode);
  const postExplainTutoringRef = useRef(postExplainTutoring);
  autoInitializeRef.current = autoInitialize;
  initialGreetingModeRef.current = initialGreetingMode;
  postExplainTutoringRef.current = postExplainTutoring;
  const priorSubmissionIdsRef = useRef<string[] | undefined>(priorSubmissionIds);
  priorSubmissionIdsRef.current = priorSubmissionIds;
  const { language: uiLanguage } = useLanguage();

  const language = getAssignmentLanguage(assignmentInstructions, uiLanguage);

  const appendAssistantStreamToken = useCallback((streamGen: number, token: string) => {
    if (streamGen !== streamGenerationRef.current) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        const nextContent = last.content + token;
        return [...prev.slice(0, -1), { ...last, content: nextContent }];
      }
      return prev;
    });
  }, []);

  /** Replace the last assistant message body atomically (used for post-stream polish frame). */
  const replaceLastAssistantContent = useCallback((streamGen: number, polished: string) => {
    if (streamGen !== streamGenerationRef.current) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, content: polished }];
      }
      return prev;
    });
  }, []);

  const initializeConversation = useCallback(
    async (mode: InitialGreetingMode = 'default') => {
      if (initInFlightRef.current) {
        return;
      }
      initInFlightRef.current = true;
      const streamGen = streamGenerationRef.current;
      setSending(true);
      try {
        const request: ChatRequest = {
          message: '',
          submissionId,
          assignmentId,
          isInitialGreeting: true,
          initialGreetingMode: mode,
          language,
          ...(priorSubmissionIdsRef.current?.length
            ? { priorSubmissionIds: priorSubmissionIdsRef.current }
            : {}),
          ...(debugChat ? { debugChat: true } : {}),
          ...(postExplainTutoringRef.current ? { postExplainTutoring: true } : {}),
        };

        const aiMessage: Message = { role: 'assistant', content: '' };
        setMessages([aiMessage]);
        setLastAssistantDebug(null);

        const { data: endData, error: chatError } = await streamChatMessage(
          request,
          (token) => {
            appendAssistantStreamToken(streamGen, token);
          }
        );

        if (streamGen !== streamGenerationRef.current) {
          return;
        }

        if (chatError) {
          setError(chatError);
          toast.error('Error starting conversation');
          setMessages([]);
          return;
        }
        if (endData?.debug) {
          setLastAssistantDebug(endData.debug);
        }
        if (endData?.shouldEnd && !companionMode) {
          setConversationEnded(true);
        }
      } catch {
        if (streamGen === streamGenerationRef.current) {
          toast.error('Error starting conversation');
        }
      } finally {
        if (streamGen === streamGenerationRef.current) {
          initInFlightRef.current = false;
          setSending(false);
          setLoading(false);
        }
      }
    },
    [submissionId, assignmentId, language, debugChat, companionMode, appendAssistantStreamToken],
  );

  const loadConversation = useCallback(async () => {
    loadCompletedRef.current = false;
    try {
      const { data, error: fetchError } = await supabase
        .from('assignment_conversations')
        .select('messages, completed_task_indexes')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        const rawMessages = data.messages as unknown as Message[];
        const lastAssistantRaw = [...rawMessages].reverse().find((m) => m.role === 'assistant');
        let markerDetected = false;
        let semanticDetected = false;
        let tasksComplete = false;
        if (lastAssistantRaw && !companionMode) {
          const upperContent = String(lastAssistantRaw.content).toUpperCase();
          const semanticPhrases = [
            'WE ARE DONE',
            'COMPLETED ALL THE TASKS',
            'FINISHED ALL THE TASKS',
            'COMPLETED THE ASSIGNMENT',
            'FINISHED THE ASSIGNMENT',
            'YOU HAVE COMPLETED ALL',
            'YOU COMPLETED ALL',
            'YOU\'VE COMPLETED ALL',
            'SUCCESSFULLY ANSWERED ALL',
            'ACTIVITY IS COMPLETE',
            'YES, WE ARE DONE',
            'WE\'VE ACTUALLY COMPLETED ALL',
            'JOB ON COMPLETING THE TASKS',
            'COMPLETING THE TASKS',
            'DONE WITH THE TASKS',
            'FINISHED THE TASKS',
            'FINISHED THE ACTIVITY',
            'COMPLETED THE ACTIVITY',
            'YOU HAVE FINISHED',
            'YOU\'VE FINISHED',
            'ALL TASKS ARE COMPLETE',
            'סיימנו את המשימה',
            'השלמת את כל המשימות',
            'כל הכבוד על סיום המטלה',
            'סיימת את המטלה',
            'סיימת את הפעילות',
          ];
          markerDetected = hasConversationCompleteMarker(String(lastAssistantRaw.content));
          semanticDetected = semanticPhrases.some((phrase) => upperContent.includes(phrase));
          const tutorText = resolveAssignmentTutorText(assignmentInstructions, studentFacingTask);
          tasksComplete = areAllParsedTasksComplete(tutorText, data.completed_task_indexes);
          if (markerDetected || semanticDetected || tasksComplete) {
            setConversationEnded(true);
          }
        }
        const loadedMessages = rehydrateMessages(rawMessages);
        setMessages(loadedMessages);
      }
      // Empty conversation: greeting is started only by the autoInitialize effect (single init path).
    } catch {
      toast.error('Error loading conversation');
    } finally {
      setLoading(false);
      loadCompletedRef.current = true;
    }
  }, [submissionId, companionMode, assignmentInstructions, studentFacingTask]);

  const loadConversationRef = useRef(loadConversation);
  loadConversationRef.current = loadConversation;

  const sendMessage = async (
    content: string,
    fileContext?: { name: string; content: string; url?: string; type?: string },
  ) => {
    if (!content.trim() && !fileContext) return;

    const userMessage: Message = { role: 'user', content, fileContext };
    const streamGen = streamGenerationRef.current;
    setMessages((prev) => [...prev, userMessage, { role: 'assistant', content: '' }]);
    setSending(true);
    setLastAssistantDebug(null);

    try {
      const request: ChatRequest = {
        message: content,
        submissionId,
        assignmentId,
        language,
        ...(fileContext ? { fileContext } : {}),
        ...(priorSubmissionIdsRef.current?.length
          ? { priorSubmissionIds: priorSubmissionIdsRef.current }
          : {}),
        ...(debugChat ? { debugChat: true } : {}),
        ...(postExplainTutoringRef.current ? { postExplainTutoring: true } : {}),
      };

      const { data, error: chatError } = await streamChatMessage(
        request,
        (token) => {
          appendAssistantStreamToken(streamGen, token);
        }
      );

      if (streamGen !== streamGenerationRef.current) {
        return;
      }

      if (chatError) {
        setError(chatError);
        toast.error('Error communicating with Perleap agent');
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (data?.debug) {
        setLastAssistantDebug(data.debug);
      }

      if (data?.shouldEnd && !companionMode) {
        setConversationEnded(true);
      }
    } catch {
      toast.error('Error sending message');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!hasLoadedSubmission.current) {
      hasLoadedSubmission.current = true;
      void loadConversationRef.current();
    }

    return () => {
      streamGenerationRef.current += 1;
      initInFlightRef.current = false;
      initScheduledRef.current = false;
      hasLoadedSubmission.current = false;
      loadCompletedRef.current = false;
    };
  }, [submissionId]);

  /** Start greeting when task-understanding gate opens (autoInitialize false → true). */
  useEffect(() => {
    if (!autoInitialize || !loadCompletedRef.current || loading || sending || initInFlightRef.current) {
      return;
    }
    if (messages.length > 0) return;
    if (initScheduledRef.current) return;
    initScheduledRef.current = true;
    void initializeConversation(initialGreetingModeRef.current).finally(() => {
      initScheduledRef.current = false;
    });
  }, [autoInitialize, loading, sending, messages.length, initializeConversation]);

  const initializeConversationExposed = useCallback(
    async (mode: InitialGreetingMode = 'default') => {
      await initializeConversation(mode);
    },
    [initializeConversation],
  );

  return {
    messages,
    loading,
    sending,
    error,
    conversationEnded,
    language,
    lastAssistantDebug,
    sendMessage,
    initializeConversation: initializeConversationExposed,
  };
};
