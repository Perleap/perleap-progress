/**
 * Conversation Hook
 * Custom hook for managing assignment conversations
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/api/client';
import { sendChatMessage, streamChatMessage } from '@/services';
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
        const loadedMessages = data.messages as Message[];
        setMessages(loadedMessages);
        
        // Check if any existing assistant message indicates completion
        const lastAssistantMessage = [...loadedMessages].reverse().find(m => m.role === 'assistant');
        if (lastAssistantMessage) {
          const upperContent = String(lastAssistantMessage.content).toUpperCase();
        const semanticPhrases = [
          'WE ARE DONE',
          'COMPLETED ALL THE TASKS',
          'FINISHED ALL THE TASKS',
          'COMPLETED THE ASSIGNMENT',
          'FINISHED THE ASSIGNMENT',
          'YOU HAVE COMPLETED ALL',
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
          'סיימת את הפעילות'
        ];
          
          if (semanticPhrases.some(phrase => upperContent.includes(phrase))) {
            setConversationEnded(true);
          }
        }
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
   * Initialize conversation with AI greeting (Streaming)
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

      const aiMessage: Message = { role: 'assistant', content: '' };
      setMessages([aiMessage]);

      const { data, error: chatError } = await streamChatMessage(request, (token) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + token }];
          }
          return prev;
        });
      });

      if (chatError) {
        setError(chatError);
        toast.error('Error starting conversation');
        setMessages([]); // Remove the empty assistant message
        return;
      }
    } catch (err) {
      toast.error('Error starting conversation');
    } finally {
      setSending(false);
      setLoading(false);
    }
  };

  /**
   * Send a user message (Streaming)
   */
  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage, { role: 'assistant', content: '' }]);
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

      const { data, error: chatError } = await streamChatMessage(request, (token) => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + token }];
          }
          return prev;
        });
      });

      if (chatError) {
        setError(chatError);
        toast.error('Error communicating with Perleap agent');
        // Remove the empty assistant message, keep user message for retry/copy
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      if (data?.shouldEnd) {
        setConversationEnded(true);
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
