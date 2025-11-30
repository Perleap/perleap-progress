/**
 * Conversation Hook
 * Custom hook for managing assignment conversations
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/api/client';
import { sendChatMessage } from '@/services';
import type { Message, ApiError, ChatRequest } from '@/types';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAssignmentLanguage } from '@/utils/languageDetection';

interface UseConversationResult {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  error: ApiError | null;
  conversationEnded: boolean;
  sendMessage: (content: string) => Promise<void>;
  initializeConversation: () => Promise<void>;
}

interface UseConversationParams {
  submissionId: string;
  assignmentInstructions: string;
  studentId: string;
  assignmentId: string;
}

/**
 * Hook to manage assignment conversation state
 */
export const useConversation = ({
  submissionId,
  assignmentInstructions,
  studentId,
  assignmentId,
}: UseConversationParams): UseConversationResult => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationEnded, setConversationEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const hasInitialized = useRef(false);
  const { language: uiLanguage } = useLanguage();
  
  // Detect language from assignment instructions
  // If instructions are in Hebrew, use Hebrew regardless of UI language
  const language = getAssignmentLanguage(assignmentInstructions, uiLanguage);

  /**
   * Load existing conversation from database
   */
  const loadConversation = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('assignment_conversations')
        .select('messages')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(data.messages as Message[]);
      } else {
        await initializeConversation();
      }
    } catch (err) {
      toast.error('Error loading conversation');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initialize conversation with AI greeting
   */
  const initializeConversation = async () => {
    setSending(true);
    try {
      const request: ChatRequest = {
        message:
          '[System: This is the start of the conversation. Please greet the student warmly and introduce yourself.]',
        assignmentInstructions,
        submissionId,
        studentId,
        assignmentId,
        isInitialGreeting: true,
        language,
      };

      const { data, error: chatError } = await sendChatMessage(request);

      if (chatError) {
        setError(chatError);
        toast.error('Error starting conversation');
        return;
      }

      if (data) {
        const aiMessage: Message = { role: 'assistant', content: data.message };
        setMessages([aiMessage]);
      }
    } catch (err) {
      toast.error('Error starting conversation');
    } finally {
      setSending(false);
      setLoading(false);
    }
  };

  /**
   * Send a user message
   */
  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    try {
      const request: ChatRequest = {
        message: content,
        assignmentInstructions,
        submissionId,
        studentId,
        assignmentId,
        language,
      };

      const { data, error: chatError } = await sendChatMessage(request);

      if (chatError) {
        setError(chatError);
        toast.error('Error communicating with Perleap agent');
        return;
      }

      if (data) {
        const aiMessage: Message = { role: 'assistant', content: data.message };
        setMessages((prev) => [...prev, aiMessage]);
        
        if (data.shouldEnd) {
          setConversationEnded(true);
        }
      }
    } catch (err) {
      toast.error('Error sending message');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      loadConversation();
    }

    return () => {
      hasInitialized.current = false;
    };
  }, [submissionId]);

  return {
    messages,
    loading,
    sending,
    error,
    conversationEnded,
    sendMessage,
    initializeConversation,
  };
};
