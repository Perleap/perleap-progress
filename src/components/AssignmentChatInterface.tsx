import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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
import { Send, Loader2, CheckCircle, Volume2, VolumeX, Mic, Square, Play, Pause, Paperclip, X } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConversation } from '@/hooks/useConversation';
import { useStudentProfile } from '@/hooks/queries';
import { synthesizeSpeech, transcribeAudio } from '@/services/speechService';
import { validateChatAttachmentFile } from '@/lib/chatAttachment';
import { formatInlineListsForChatMarkdown, splitChatDisplayText } from '@/lib/chatDisplay';
import { detectUnderstandingCue } from '@/lib/understandingCueDetection';
import SafeMathMarkdown from './SafeMathMarkdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  fileContext?: {
    name: string;
    content: string;
    url?: string;
    type?: string;
  };
}

interface NuanceTrackingCallbacks {
  trackResponseSubmitted: (responseTimeMs: number, messageIndex: number) => void;
  trackResponseStarted: (messageIndex: number) => void;
  recordAiMessageArrival: () => void;
  getTimeSinceLastAiMessage: () => number | null;
  trackUnderstandingCue: (
    result: import('@/lib/understandingCueDetection').UnderstandingCueResult,
    messageLength: number,
    messageIndex: number,
  ) => void;
}

export type AssignmentChatCompletePayload = {
  /** True when the green "conversation complete" state was true at submit. */
  conversationComplete: boolean;
};

interface AssignmentChatInterfaceProps {
  assignmentId: string;
  assignmentTitle: string;
  teacherName: string;
  assignmentInstructions: string;
  submissionId: string;
  onComplete: (payload: AssignmentChatCompletePayload) => void | Promise<void>;
  nuanceTracking?: NuanceTrackingCallbacks;
  /** primary = chat completes the assignment; companion = Q&A only above another task UI */
  variant?: 'primary' | 'companion';
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Image as ImageIcon, ExternalLink, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const CHAT_INPUT_MAX_HEIGHT_PX = 200;

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
  nuanceTracking,
  variant = 'primary',
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
  const [activeTab, setActiveTab] = useState('chat');
  const [previewResource, setPreviewResource] = useState<{ name: string; content: string; url?: string; type?: string; messageIndex: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // File attachment state
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string; url?: string; type?: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = chatInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, CHAT_INPUT_MAX_HEIGHT_PX)}px`;
  }, [input]);

  // Nuance tracking: detect first keystroke after AI message
  const hasTrackedTypingStart = useRef(false);
  const prevSendingRef = useRef(false);

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
    companionMode: variant === 'companion',
  });

  // Update local state when hook reports conversation ended (primary assignments only)
  useEffect(() => {
    if (variant === 'primary' && hookConversationEnded && !conversationEnded) {
      setConversationEnded(true);
      setDialogType('aiDetected');
    }
  }, [variant, hookConversationEnded, conversationEnded]);

  // Nuance: record AI message arrival when streaming finishes
  useEffect(() => {
    if (prevSendingRef.current && !sending && nuanceTracking) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'assistant' && lastMsg.content) {
        nuanceTracking.recordAiMessageArrival();
        hasTrackedTypingStart.current = false;
      }
    }
    prevSendingRef.current = sending;
  }, [sending, messages, nuanceTracking]);

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

  const processAttachmentFile = useCallback(
    async (file: File) => {
      const validated = validateChatAttachmentFile(file);
      if (validated.ok === false) {
        toast.error(
          validated.reason === 'size'
            ? t('assignmentChat.errors.fileTooLarge')
            : t('assignmentChat.errors.fileTypeNotAllowed'),
        );
        return;
      }

      setUploadingFile(true);
      try {
        const isText =
          file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt');

        if (isText) {
          const text = await file.text();
          setAttachedFile({ name: file.name, content: text, type: 'text' });
        } else {
          const safeName = file.name?.trim() || `pasted-${Date.now()}.bin`;
          const filePath = `${submissionId}/${Date.now()}_${safeName}`;

          const { error } = await supabase.storage.from('submission-files').upload(filePath, file, { upsert: true });

          if (error) {
            throw error;
          }

          const { data: urlData } = supabase.storage.from('submission-files').getPublicUrl(filePath);

          const isImage = file.type.startsWith('image/');
          setAttachedFile({
            name: safeName,
            content: `[File: ${safeName}]\nURL: ${urlData.publicUrl}`,
            url: urlData.publicUrl,
            type: isImage ? 'image' : 'pdf',
          });
        }
        toast.success(t('assignmentChat.success.fileAttached'));
      } catch (err) {
        toast.error(t('assignmentChat.errors.fileUpload'));
      } finally {
        setUploadingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [submissionId, t],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await processAttachmentFile(file);
    },
    [processAttachmentFile],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (items?.length) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              await processAttachmentFile(file);
              return;
            }
          }
        }
      }
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        await processAttachmentFile(files[0]);
      }
    },
    [processAttachmentFile],
  );

  const handleSendMessage = async () => {
    if ((!input.trim() && !attachedFile) || loading || sending) return;

    if (nuanceTracking) {
      const elapsed = nuanceTracking.getTimeSinceLastAiMessage();
      if (elapsed !== null) {
        nuanceTracking.trackResponseSubmitted(elapsed, messages.length);
      }
    }

    const userMessage = input.trim();
    if (userMessage) {
      if (nuanceTracking) {
        const cue = detectUnderstandingCue(userMessage);
        nuanceTracking.trackUnderstandingCue(cue, userMessage.length, messages.length);
      } else if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug(
          '[Nuance] no tracking hook on chat — understanding cues are skipped (e.g. wrong route or tracking disabled)',
        );
      }
    }
    setInput('');
    const fileCtx = attachedFile ?? undefined;
    setAttachedFile(null);
    shouldScrollRef.current = true;

    await sendConversationMessage(userMessage, fileCtx);
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await onComplete({ conversationComplete: conversationEnded });
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
      
      const cleanedText = cleanTextForTTS(formatInlineListsForChatMarkdown(text));
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

      audio.onerror = () => {
        // If we just reset the source manually, don't show an error
        if (audio.src === '' || audio.src === window.location.href) return;

        const error = audio.error;
        console.error('Audio element error details:', {
          code: error?.code,
          message: error?.message,
          src: audio.src,
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
          toast.error(t('assignmentChat.errors.stt'));
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
      toast.error(t('assignmentChat.errors.micAccess'));
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

  const handleViewInChat = (index: number) => {
    setPreviewResource(null);
    setActiveTab('chat');
    // Give tab time to render before scrolling
    setTimeout(() => {
      const messageElement = document.getElementById(`message-${index}`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Optional: Add a brief highlight effect
        messageElement.classList.add('bg-primary/10');
        setTimeout(() => messageElement.classList.remove('bg-primary/10'), 2000);
      }
    }, 100);
  };

  const resources = messages
    .map((m, i) => ({ ...m, originalIndex: i }))
    .filter(m => m.role === 'user' && m.fileContext);


  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              {teacherName} - {assignmentTitle}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 mb-2">
              <TabsTrigger value="chat">{t('assignmentChat.tabs.chat', 'Chat')}</TabsTrigger>
              <TabsTrigger value="resources">
                {t('assignmentChat.tabs.resources', 'Resources')}
                {resources.length > 0 && (
                  <span className="ml-2 bg-primary/20 text-primary text-xs rounded-full px-2 py-0.5">
                    {resources.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Chat Tab - Using CSS hidden instead of conditional rendering to preserve state/scroll */}
            <div className={`flex-1 flex flex-col min-h-0 ${activeTab !== 'chat' ? 'hidden' : ''}`}>
              <ScrollArea className="flex-1 pr-4 mb-4">
                <div className="space-y-4 pt-2 pb-4">
                  {messages.map((message, index) => {
                    const isUser = message.role === 'user';
                    const displayParts =
                      isUser || !message.content
                        ? [String(message.content || '')]
                        : splitChatDisplayText(
                            formatInlineListsForChatMarkdown(String(message.content)),
                          );
                    // User messages always on the right side of the chat (end)
                    // Assistant messages always on the left side of the chat (start)
                    // This is standard chat convention regardless of language direction
                    return (
                      <div
                        key={index}
                        id={`message-${index}`}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'} transition-colors duration-500 rounded-lg`}
                      >
                        <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
                          {displayParts.map((part, partIdx) => (
                            <div
                              key={`${index}-p-${partIdx}`}
                              className={`rounded-lg p-3 bg-muted`}
                              dir="auto"
                              style={{
                                unicodeBidi: 'plaintext',
                                animationDelay: !isUser && partIdx > 0 ? `${partIdx * 45}ms` : undefined,
                              }}
                            >
                              <div className={`text-sm markdown-content`}>
                                {part ? <SafeMathMarkdown content={part} /> : null}
                              </div>
                            </div>
                          ))}

                            {/* Render attachment underneath the message text */}
                            {message.fileContext && (
                              <div 
                                className={`p-2 rounded-md border bg-background/50 flex items-center gap-2 cursor-pointer hover:bg-background transition-colors max-w-full ${!message.content ? 'mt-0' : ''}`}
                                onClick={() => setPreviewResource({ ...message.fileContext!, messageIndex: index })}
                              >
                                {message.fileContext.type === 'image' ? (
                                  <ImageIcon className="h-4 w-4 text-primary" />
                                ) : (
                                  <FileText className="h-4 w-4 text-primary" />
                                )}
                                <span className="text-sm font-medium truncate max-w-[200px]">
                                  {message.fileContext.name}
                                </span>
                              </div>
                            )}
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

              {variant === 'primary' && conversationEnded && (
                <div
                  className={`bg-success/10 border border-success/20 rounded-lg p-3 text-sm text-success mb-4 ${isRTL ? 'text-right' : 'text-left'}`}
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  {isRTL ? '✓ ' : ''}
                  {t('assignmentChat.conversationComplete', 'Conversation complete! You can now finish the activity.')}
                  {!isRTL ? ' ✓' : ''}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileSelect}
              />

              {attachedFile && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm mb-2">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate text-foreground">{attachedFile.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0 ml-auto shrink-0"
                    onClick={() => setAttachedFile(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              <div className="flex gap-1.5 items-end mb-4">
                <div className="flex-1 relative">
                  <Textarea
                    ref={chatInputRef}
                    placeholder={conversationEnded ? t('assignmentChat.conversationEndedPlaceholder', 'Conversation ended - please complete the activity') : t('assignmentChat.placeholder')}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (!hasTrackedTypingStart.current && e.target.value && nuanceTracking) {
                        nuanceTracking.trackResponseStarted(messages.length);
                        hasTrackedTypingStart.current = true;
                      }
                    }}
                    onPaste={(e) => void handlePaste(e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isDisabled && (input.trim() || attachedFile)) {
                          handleSendMessage();
                        }
                      }
                    }}
                    disabled={isDisabled}
                    className={`min-h-[44px] max-h-[200px] resize-none overflow-y-auto ${isRTL ? 'pl-11 text-right' : 'pr-11 text-left'}`}
                    rows={1}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    autoDirection
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`absolute bottom-1.5 ${isRTL ? 'left-3' : 'right-3'} h-8 w-8 rounded-full ${isRecording ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isDisabled}
                  >
                    {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-10 w-10 shrink-0 rounded-full ${uploadingFile ? 'text-primary animate-pulse' : attachedFile ? 'text-primary' : 'text-muted-foreground'}`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isDisabled || uploadingFile}
                  type="button"
                >
                  {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={isDisabled || (!input.trim() && !attachedFile)}
                  size="icon"
                  className="h-10 w-10 shrink-0"
                >
                  {(loading || sending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>

              {variant === 'primary' ? (
                <Button
                  onClick={handleComplete}
                  disabled={!canComplete}
                  className="w-full mt-auto"
                  variant={conversationEnded ? 'default' : 'secondary'}
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
              ) : null}
            </div>

            <TabsContent value="resources" className="flex-1 mt-0 overflow-visible">
              <ScrollArea className="h-[400px]">
                {resources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2 py-10">
                    <Paperclip className="h-8 w-8 opacity-50" />
                    <p>{t('assignmentChat.resources.empty', 'No resources uploaded yet')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 px-3 pb-3">
                    {resources.map((msg, idx) => (
                      <Card 
                        key={idx} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setPreviewResource({ ...msg.fileContext!, messageIndex: msg.originalIndex })}
                      >
                        <CardContent className="p-3 flex items-start gap-3">
                          <div className="bg-primary/10 p-2 rounded-md shrink-0">
                            {msg.fileContext?.type === 'image' ? (
                              <ImageIcon className="h-5 w-5 text-primary" />
                            ) : (
                              <FileText className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" title={msg.fileContext?.name}>
                              {msg.fileContext?.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {msg.fileContext?.type === 'image' ? 'Image' : 'Document'}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card >

      <Dialog open={!!previewResource} onOpenChange={(open) => { if (!open) { setPreviewResource(null); setZoomLevel(1); } }}>
        <DialogContent showCloseButton={false} className="max-w-5xl w-[90vw] max-h-[92vh] flex flex-col">
          <DialogHeader className="space-y-0 pb-2">
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="text-base font-semibold break-words line-clamp-2 min-w-0 pt-0.5">
                {previewResource?.name}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={() => { setPreviewResource(null); setZoomLevel(1); }}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              {previewResource?.type === 'image' && (
                <div className="flex items-center gap-1 border rounded-md px-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setZoomLevel(z => Math.max(0.25, z - 0.25))}
                    disabled={zoomLevel <= 0.25}
                  >
                    <ZoomOut className="h-4 w-4" />
                    <span className="sr-only">Zoom out</span>
                  </Button>
                  <span className="text-xs font-medium min-w-[3rem] text-center tabular-nums">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setZoomLevel(z => Math.min(5, z + 0.25))}
                    disabled={zoomLevel >= 5}
                  >
                    <ZoomIn className="h-4 w-4" />
                    <span className="sr-only">Zoom in</span>
                  </Button>
                  {zoomLevel !== 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setZoomLevel(1)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="sr-only">Reset zoom</span>
                    </Button>
                  )}
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => previewResource && handleViewInChat(previewResource.messageIndex)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View in Chat
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-[50vh] border rounded-md p-4 bg-muted/30">
            {previewResource?.type === 'image' && previewResource.url ? (
              <div className="flex items-center justify-center min-h-full">
                <img 
                  src={previewResource.url} 
                  alt={previewResource.name} 
                  className="w-full h-auto object-contain transition-transform duration-200"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                />
              </div>
            ) : previewResource?.type === 'pdf' && previewResource.url ? (
              <iframe 
                src={previewResource.url} 
                className="w-full h-full min-h-[500px]" 
                title={previewResource.name}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {previewResource?.content}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
