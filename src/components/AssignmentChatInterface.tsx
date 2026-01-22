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
import { Send, Loader2, CheckCircle, Volume2, VolumeX, Mic, Square, Play, Pause } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConversation } from '@/hooks/useConversation';
import { useStudentProfile } from '@/hooks/queries';
import { synthesizeSpeech, transcribeAudio } from '@/services/speechService';
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

// Helper to clean markdown for TTS
const cleanTextForTTS = (text: string) => {
  return text
    .replace(/\[CONVERSATION_COMPLETE\]/gi, '') // Remove completion marker
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Remove italic
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
    .replace(/#{1,6}\s+(.*)/g, '$1') // Remove headers
    .replace(/`{1,3}([\s\S]*?)`{1,3}/g, '$1') // Remove code blocks
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\\/g, '') // Remove backslashes
    .trim();
};

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
  const { data: profile } = useStudentProfile();

  const [input, setInput] = useState('');
  const [conversationEnded, setConversationEnded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'turnLimit' | 'aiDetected'>('turnLimit');

  // Audio & Recording states
  const [playingMessageIndex, setPlayingMessageIndex] = useState<number | null>(null);
  const [loadingAudioIndex, setLoadingAudioIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      // If we have an active stream, stop all tracks
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      // Cleanup TTS audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
    };
  }, []);

  // Use the conversation hook which handles language, greeting initialization, and API calls
  const { 
    messages, 
    loading, 
    sending, 
    conversationEnded: hookConversationEnded, 
    language: conversationLanguage,
    sendMessage: sendConversationMessage 
  } = useConversation({
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
      // setShowCompletionDialog(true); // Disable auto-popup as requested
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

  const handlePlayTTS = async (text: string, index: number) => {
    if (playingMessageIndex === index) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
      setPlayingMessageIndex(null);
      return;
    }

    // Stop and cleanup any currently playing audio and its URL
    if (audioRef.current) {
      audioRef.current.pause();
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
      try {
        // Resetting src helps stop the actual network request/buffering
        audioRef.current.src = '';
        audioRef.current.load();
      } catch (e) {
        // Ignore reset errors
      }
    }

    try {
      setLoadingAudioIndex(index);
      const voice = profile?.voice_preference || 'shimmer';
      
      const cleanedText = cleanTextForTTS(text);
      if (!cleanedText) {
        throw new Error('No text to play after cleaning');
      }

      const audioUrl = await synthesizeSpeech(cleanedText, voice);
      currentAudioUrlRef.current = audioUrl;
      
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      const audio = audioRef.current;
      audio.src = audioUrl;
      
      audio.onplay = () => {
        setLoadingAudioIndex(null);
        setPlayingMessageIndex(index);
      };

      audio.onended = () => {
        setPlayingMessageIndex(null);
        if (currentAudioUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          currentAudioUrlRef.current = null;
        }
      };

      audio.onpause = () => {
        setPlayingMessageIndex(null);
        // We don't revoke here because it might be a temporary pause or we might want to resume 
        // (though current UI doesn't support resume, just toggle)
      };

      audio.onerror = (e) => {
        // If we just reset the source manually, don't show an error
        if (audio.src === '' || audio.src === window.location.href) return;

        const error = (e.target as any).error;
        console.error('Audio element error details:', {
          code: error?.code,
          message: error?.message,
          src: audio.src
        });
        setLoadingAudioIndex(null);
        setPlayingMessageIndex(null);
        if (currentAudioUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          currentAudioUrlRef.current = null;
        }
        toast.error(t('assignmentChat.errors.tts'));
      };

      // Ensure we catch the play promise error (e.g. if interrupted by another click)
      await audio.play().catch(err => {
        if (err.name === 'AbortError') {
          // Ignore AbortError as it usually means we started a new audio before this one loaded
        } else {
          throw err;
        }
      });
    } catch (error) {
      console.error('TTS Playback catch block:', error);
      setLoadingAudioIndex(null);
      setPlayingMessageIndex(null);
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }
      // Only toast if it wasn't a manual abort
      if ((error as any).name !== 'AbortError') {
        toast.error(t('assignmentChat.errors.tts'));
      }
    }
  };

  const startRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Choose supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/ogg')
          ? 'audio/ogg'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        try {
          const text = await transcribeAudio(audioBlob, conversationLanguage);
          if (text.trim()) {
            setInput((prev) => prev + (prev ? ' ' : '') + text.trim());
          }
        } catch (error) {
          toast.error(t('assignmentChat.errors.stt', 'Error transcribing audio'));
        }
        
        // Stop all tracks to release microphone
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      };

      // Set a small timeslice to get data regularly (can help with large recordings)
      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      toast.error(t('assignmentChat.errors.micAccess', 'Microphone access denied or recording failed'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const isDisabled = loading || sending; // Allow chatting after end
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
                    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
                      <div
                        className={`rounded-lg p-3 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}
                        dir="auto"
                        style={{ unicodeBidi: 'plaintext' }}
                      >
                        <div className={`text-sm markdown-content ${isUser ? 'text-primary-foreground' : ''}`}>
                          <SafeMathMarkdown content={String(message.content || '')} />
                        </div>
                      </div>
                      {!isUser && message.content && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-8 w-8 p-0"
                          onClick={() => handlePlayTTS(message.content, index)}
                          disabled={loadingAudioIndex !== null && loadingAudioIndex !== index}
                        >
                          {loadingAudioIndex === index ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : playingMessageIndex === index ? (
                            <VolumeX className="h-4 w-4 text-primary" />
                          ) : (
                            <Volume2 className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      )}
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
              className={`bg-success/10 border border-success/20 rounded-lg p-3 text-sm text-success ${isRTL ? 'text-right' : 'text-left'}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {isRTL ? '✓ ' : ''}
              {t('assignmentChat.conversationComplete', 'Conversation complete! You can now finish the activity.')}
              {!isRTL ? ' ✓' : ''}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
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
                className={`min-h-[60px] max-h-[200px] resize-none pr-10 ${isRTL ? 'text-right' : 'text-left'}`}
                rows={2}
                dir={isRTL ? 'rtl' : 'ltr'}
                autoDirection
              />
              <Button
                variant="ghost"
                size="icon"
                className={`absolute bottom-2 ${isRTL ? 'left-2' : 'right-2'} h-8 w-8 rounded-full ${isRecording ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isDisabled}
              >
                {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
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
            variant={conversationEnded ? "default" : "secondary"}
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
