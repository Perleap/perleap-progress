import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AssignmentChatInterfaceProps {
  assignmentId: string;
  assignmentTitle: string;
  teacherName: string;
  assignmentInstructions: string;
  submissionId: string;
  onComplete: () => void;
}

export function AssignmentChatInterface({
  assignmentId,
  assignmentTitle,
  teacherName,
  assignmentInstructions,
  submissionId,
  onComplete,
}: AssignmentChatInterfaceProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'turnLimit' | 'aiDetected'>('turnLimit');
  const [lastDialogTurnCount, setLastDialogTurnCount] = useState(0);
  const [currentTurnCount, setCurrentTurnCount] = useState(0);
  const [conversationEnded, setConversationEnded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const generateInitialGreeting = useCallback(async () => {
    setLoading(true);
    try {
      const { data: promptData, error: promptError } = await supabase
        .from('ai_prompts')
        .select('prompt_template')
        .eq('prompt_key', 'chat_initial_greeting')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (promptError) throw promptError;

      // Fallback if prompt is not found in database
      const promptTemplate =
        promptData?.prompt_template ||
        '[System: This is the start of the conversation. Please greet the student warmly and introduce yourself.]';

      const { data, error } = await supabase.functions.invoke('perleap-chat', {
        body: {
          message: promptTemplate,
          assignmentInstructions,
          submissionId,
          studentId: user!.id,
          assignmentId,
          isInitialGreeting: true,
          language: language,
        },
      });

      if (error) throw error;

      setMessages([{ role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Error generating initial greeting:', error);
      toast.error(t('assignmentChat.errors.startingConversation'));
    } finally {
      setLoading(false);
    }
  }, [assignmentId, assignmentInstructions, submissionId, user, language]);

  const loadConversation = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('assignment_conversations')
        .select('messages')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(data.messages as unknown as Message[]);
      } else {
        await generateInitialGreeting();
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error(t('assignmentChat.errors.loadingConversation'));
    }
  }, [submissionId, generateInitialGreeting, t]);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      loadConversation();
    }

    // Don't reset on unmount - this was causing refetches on tab switch
    // The component will naturally reload conversation if submissionId changes
  }, [submissionId, loadConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const sendMessage = async () => {
    const messageText = input.trim();
    if (!messageText) return;

    setMessages((prev) => [...prev, { role: 'user', content: messageText }]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('perleap-chat', {
        body: {
          message: messageText,
          assignmentInstructions,
          submissionId,
          studentId: user!.id,
          assignmentId,
          language: language,
        },
      });

      if (error) throw error;

      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      
      // Update turn count
      const turnCount = data.turnCount || 0;
      setCurrentTurnCount(turnCount);

      // Check if AI detected conversation should end
      if (data.shouldEnd && data.endReason === 'ai_detected') {
        console.log('🎯 AI detected completion - showing dialog');
        setConversationEnded(true);
        setDialogType('aiDetected');
        setShowCompletionDialog(true);
        return;
      }

      // Check for turn limit - show dialog at 8, 12, 16, etc. (every 4 turns after the first popup)
      const shouldShowTurnDialog = 
        turnCount >= 8 && 
        (lastDialogTurnCount === 0 ? turnCount === 8 : turnCount >= lastDialogTurnCount + 4);

      if (shouldShowTurnDialog) {
        console.log(`📊 Turn limit reached: ${turnCount} exchanges - showing dialog`);
        setDialogType('turnLimit');
        setShowCompletionDialog(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t('assignmentChat.errors.communicating'));
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const { error } = await supabase.functions.invoke('generate-feedback', {
        body: {
          submissionId,
          studentId: user!.id,
          assignmentId,
          language: language,
        },
      });

      if (error) throw error;

      toast.success(t('assignmentChat.success.activityCompleted'));
      onComplete();
    } catch (error) {
      console.error('Error generating feedback:', error);
      toast.error(t('assignmentChat.errors.generatingFeedback'));
    } finally {
      setCompleting(false);
    }
  };

  const handleDialogComplete = () => {
    setShowCompletionDialog(false);
    handleComplete();
  };

  const handleDialogContinue = () => {
    setShowCompletionDialog(false);
    // Update the last dialog turn count for turn-limit dialogs
    if (dialogType === 'turnLimit') {
      setLastDialogTurnCount(currentTurnCount);
    }
    // If it was AI detected, allow them to continue but reset the flag
    if (dialogType === 'aiDetected') {
      setConversationEnded(false);
    }
  };

  const isDisabled = loading || completing || conversationEnded;
  const canComplete = messages.length >= 2 && !completing;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            {teacherName} - {assignmentTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {messages.map((message, index) => {
                const isUser = message.role === 'user';
                return (
                  <div
                    key={index}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    dir="auto"
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap" dir="auto">
                        {message.content}
                      </p>
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {conversationEnded && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-800 dark:text-green-200">
              ✓ {t('assignmentChat.conversationComplete', 'Conversation complete! You can now finish the activity.')}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <Textarea
              placeholder={conversationEnded ? t('assignmentChat.conversationEndedPlaceholder', 'Conversation ended - please complete the activity') : t('assignmentChat.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isDisabled && input.trim()) {
                    sendMessage();
                  }
                }
              }}
              disabled={isDisabled}
              className="min-h-[60px] max-h-[200px] resize-none"
              rows={2}
            />
            <Button
              onClick={sendMessage}
              disabled={isDisabled || !input.trim()}
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          <Button
            onClick={handleComplete}
            disabled={!canComplete}
            className="w-full"
            variant="secondary"
          >
            {completing ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t('assignmentChat.generatingFeedback')}
              </>
            ) : (
              <>
                <CheckCircle className="me-2 h-4 w-4" />
                {t('assignmentChat.completeActivity')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogType === 'turnLimit'
                ? t('assignmentChat.completionDialog.turnLimitTitle')
                : t('assignmentChat.completionDialog.aiDetectedTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogType === 'turnLimit'
                ? t('assignmentChat.completionDialog.turnLimitDescription')
                : t('assignmentChat.completionDialog.aiDetectedDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDialogContinue}>
              {t('assignmentChat.completionDialog.continueButton')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDialogComplete}>
              {t('assignmentChat.completionDialog.completeButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
