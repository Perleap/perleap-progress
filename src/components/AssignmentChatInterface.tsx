import { useState, useEffect, useRef } from 'react';
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
import { toast } from 'sonner';
import { Send, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConversation } from '@/hooks/useConversation';
import SafeMathMarkdown from './SafeMathMarkdown';

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

  const [input, setInput] = useState('');
  const [conversationEnded, setConversationEnded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'turnLimit' | 'aiDetected'>('turnLimit');

  // Use the conversation hook which handles language, greeting initialization, and API calls
  const { messages, loading, sending, conversationEnded: hookConversationEnded, sendMessage: sendConversationMessage } = useConversation({
    submissionId,
    assignmentInstructions,
    studentId: user?.id || '',
    assignmentId,
  });

  // Update local state when hook reports conversation ended
  useEffect(() => {
    if (hookConversationEnded && !conversationEnded) {
      setConversationEnded(true);
      setDialogType('aiDetected');
      setShowCompletionDialog(true);
    }
  }, [hookConversationEnded, conversationEnded]);

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
  }, [messages, loading, sending]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading || sending) return;

    const userMessage = input.trim();
    setInput('');
    shouldScrollRef.current = true;

    await sendConversationMessage(userMessage);
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

  const isDisabled = loading || sending || conversationEnded;
  const canComplete = messages.length > 0;

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="px-4 py-3 border-b">
          <CardTitle className="text-base font-medium">
            {teacherName} - {assignmentTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4 pt-2">
              {messages.map((message, index) => {
                const isUser = message.role === 'user';
                // User messages always on the right side of the chat (end)
                // Assistant messages always on the left side of the chat (start)
                // This is standard chat convention regardless of language direction
                return (
                  <div
                    key={index}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}
                      dir="auto"
                      style={{ unicodeBidi: 'plaintext' }}
                    >
                      <div className={`text-sm markdown-content ${isUser ? 'text-primary-foreground' : ''}`}>
                        <SafeMathMarkdown content={String(message.content || '')} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {(loading || sending) && (
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
            <div 
              className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-800 dark:text-green-200 ${isRTL ? 'text-right' : 'text-left'}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {isRTL ? '✓ ' : ''}
              {t('assignmentChat.conversationComplete', 'Conversation complete! You can now finish the activity.')}
              {!isRTL ? ' ✓' : ''}
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
                    handleSendMessage();
                  }
                }
              }}
              disabled={isDisabled}
              className={`min-h-[60px] max-h-[200px] resize-none ${isRTL ? 'text-right' : 'text-left'}`}
              rows={2}
              dir={isRTL ? 'rtl' : 'ltr'}
              autoDirection
            />
            <Button
              onClick={handleSendMessage}
              disabled={isDisabled || !input.trim()}
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              {(loading || sending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
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
          <AlertDialogFooter className={isRTL ? 'flex-row-reverse justify-start gap-2' : 'flex-row justify-end gap-2'}>
            <AlertDialogCancel onClick={handleDialogContinue} className="mt-0">
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
