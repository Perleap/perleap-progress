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
  const { user } = useAuth();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationEnded, setConversationEnded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'turnLimit' | 'aiDetected'>('turnLimit');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (shouldScrollRef.current) {
      scrollToBottom();
      shouldScrollRef.current = false;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!user || !submissionId) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('assignment_chat_history')
          .select('*')
          .eq('submission_id', submissionId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data) {
          setMessages(data.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })));
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error(t('assignmentChat.errors.loadingMessages'));
      }
    };

    fetchMessages();
  }, [user, submissionId, t]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !user) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    shouldScrollRef.current = true;

    try {
      const { error: saveError } = await supabase
        .from('assignment_chat_history')
        .insert({
          submission_id: submissionId,
          role: 'user',
          content: userMessage,
          user_id: user.id
        });

      if (saveError) throw saveError;

      const { data, error: aiError } = await supabase.functions.invoke('chat-with-teacher', {
        body: {
          submissionId,
          message: userMessage,
          assignmentId,
          teacherName,
          assignmentTitle,
          instructions: assignmentInstructions
        }
      });

      if (aiError) throw aiError;

      if (data?.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        shouldScrollRef.current = true;

        await supabase
          .from('assignment_chat_history')
          .insert({
            submission_id: submissionId,
            role: 'assistant',
            content: data.reply,
            user_id: user.id
          });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t('assignmentChat.errors.sendingMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await onComplete();
    } catch (error) {
      toast.error(t('assignmentChat.errors.completing'));
    } finally {
      setCompleting(false);
    }
  };

  const handleDialogContinue = () => setShowCompletionDialog(false);
  const handleDialogComplete = () => {
    setShowCompletionDialog(false);
    handleComplete();
  };

  const isDisabled = loading || conversationEnded;
  const canComplete = messages.length > 0;

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="px-4 py-3 border-b">
          <CardTitle className="text-base font-medium">
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
                      className={`max-w-[80%] rounded-lg p-3 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
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
      </Card >

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
