import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Trash2, Loader2, Sparkles, Bot } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getTeacherProfile } from '@/services/profileService';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatInlineListsForChatMarkdown } from '@/lib/chatDisplay';
import SafeMathMarkdown from '../SafeMathMarkdown';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type TeacherAssistantContextValue = {
  isOpen: boolean;
  toggle: () => void;
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  handleSend: () => Promise<void>;
  clearChat: () => void;
  scrollEndRef: React.RefObject<HTMLDivElement | null>;
};

const TeacherAssistantContext = createContext<TeacherAssistantContextValue | null>(null);

function useTeacherAssistantContext() {
  return useContext(TeacherAssistantContext);
}

export function TeacherAssistantProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [teacherFullName, setTeacherFullName] = useState<string | null>(null);
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const isTeacher =
    user?.user_metadata?.role === 'teacher' || user?.user_metadata?.role === 'admin';

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id || !isTeacher) {
      setTeacherFullName(null);
      return;
    }
    let cancelled = false;
    void getTeacherProfile(user.id).then(({ data }) => {
      if (!cancelled) setTeacherFullName(data?.full_name ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, isTeacher]);

  useEffect(() => {
    if (user?.id && isTeacher) {
      const stored = localStorage.getItem(`teacher_assistant_chat_${user.id}`);
      if (stored) {
        try {
          setMessages(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse chat history', e);
        }
      }
    }
  }, [user?.id, isTeacher]);

  useEffect(() => {
    if (user?.id && messages.length > 0) {
      localStorage.setItem(`teacher_assistant_chat_${user.id}`, JSON.stringify(messages));
    } else if (user?.id && messages.length === 0) {
      localStorage.removeItem(`teacher_assistant_chat_${user.id}`);
    }
  }, [messages, user?.id]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, isOpen]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const context = {
      route: location.pathname,
      teacherName: teacherFullName ?? undefined,
    };

    try {
      const { data, error } = await supabase.functions.invoke('teacher-assistant-chat', {
        body: {
          messages: [...messages, userMsg].filter((m) => m.role !== 'system'),
          context,
        },
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.message) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.error') || 'Failed to get response');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, location.pathname, teacherFullName, t]);

  const clearChat = useCallback(() => {
    if (confirm(t('common.areYouSure') || 'Clear chat history?')) {
      setMessages([]);
    }
  }, [t]);

  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  const value = useMemo<TeacherAssistantContextValue>(
    () => ({
      isOpen,
      toggle,
      messages,
      input,
      setInput,
      isLoading,
      handleSend,
      clearChat,
      scrollEndRef,
    }),
    [isOpen, toggle, messages, input, isLoading, handleSend, clearChat],
  );

  if (!isTeacher) {
    return <>{children}</>;
  }

  return (
    <TeacherAssistantContext.Provider value={value}>
      {children}
      <TeacherAssistantPanel isRTL={isRTL} />
    </TeacherAssistantContext.Provider>
  );
}

function TeacherAssistantPanel({ isRTL }: { isRTL: boolean }) {
  const ctx = useTeacherAssistantContext();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const prevIsLoadingRef = useRef(false);
  const prevIsOpenRef = useRef(false);

  const isOpen = ctx?.isOpen ?? false;
  const isLoading = ctx?.isLoading ?? false;

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      prevIsLoadingRef.current = isLoading;
      return;
    }

    const justOpened = !prevIsOpenRef.current;
    const loadingEnded = prevIsLoadingRef.current && !isLoading;
    prevIsOpenRef.current = true;
    prevIsLoadingRef.current = isLoading;

    const shouldFocus = (justOpened && !isLoading) || loadingEnded;
    if (!shouldFocus) return;

    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  }, [isOpen, isLoading]);

  if (!ctx) return null;
  const { messages, input, setInput, handleSend, clearChat, scrollEndRef } = ctx;

  if (!isOpen) return null;

  return (
    <Card
      className={cn(
        'fixed top-[6.5rem] z-[9999] w-[90vw] md:w-96 h-[min(550px,80vh)] max-h-[80vh] shadow-2xl flex flex-col animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-300 border-border/50 overflow-hidden rounded-2xl',
        isRTL ? 'left-4' : 'right-4',
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-3 py-4 border-b bg-transparent">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <div className="p-2 bg-primary rounded-xl text-primary-foreground shadow-md">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-foreground">{t('teacherAssistant.title')}</span>
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={clearChat}
          title={t('teacherAssistant.clearChat')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden bg-muted/10 min-h-0">
        <ScrollArea className="h-[min(380px,50vh)] p-4">
          <div className="space-y-4 min-h-full">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground bg-card rounded-xl my-8 mx-2 border border-dashed">
                <Bot className="h-10 w-10 mb-3 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground/80">{t('teacherAssistant.howCanIHelp')}</p>
                <p className="text-xs mt-2 opacity-70">{t('teacherAssistant.suggestions')}</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-card border border-border rounded-bl-none text-card-foreground'
                  }`}
                >
                  <SafeMathMarkdown
                    content={m.role === 'assistant' ? formatInlineListsForChatMarkdown(m.content) : m.content}
                  />
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start w-full">
                <div className="bg-card border border-border rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" />
                  <span className="text-xs text-muted-foreground animate-pulse">{t('teacherAssistant.generating')}</span>
                </div>
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-3 bg-card border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="flex w-full items-end gap-2"
        >
          <Input
            ref={inputRef}
            placeholder={t('teacherAssistant.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-muted/50 border-border focus-visible:ring-ring min-h-[44px]"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="h-11 w-11 rounded-xl shrink-0">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className={cn('h-5 w-5', isRTL && 'rotate-180')} />
            )}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

/** Header control: place next to notifications (teachers only). */
export function TeacherAssistantTrigger({ className }: { className?: string }) {
  const ctx = useTeacherAssistantContext();
  if (!ctx) return null;

  const { isOpen, toggle } = ctx;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        'relative h-8 w-8 shrink-0 rounded-full border transition-colors',
        isOpen ? 'bg-muted text-muted-foreground border-border' : 'border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90',
        className,
      )}
      onClick={toggle}
      aria-label="Toggle AI Assistant"
    >
      {isOpen ? (
        <X className="h-4 w-4" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
    </Button>
  );
}

/** @deprecated Use `TeacherAssistantProvider` + `TeacherAssistantTrigger` in the app shell. */
export function TeacherAssistant() {
  return null;
}
