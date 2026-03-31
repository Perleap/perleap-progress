import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Trash2, Loader2, Sparkles, Bot } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import SafeMathMarkdown from '../SafeMathMarkdown';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export function TeacherAssistant() {
    const { user, profile } = useAuth();
    const { t } = useTranslation();
    const { isRTL } = useLanguage();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    // Load history
    useEffect(() => {
        if (user?.id) {
            const stored = localStorage.getItem(`teacher_assistant_chat_${user.id}`);
            if (stored) {
                try {
                    setMessages(JSON.parse(stored));
                } catch (e) {
                    console.error('Failed to parse chat history', e);
                }
            }
        }
    }, [user?.id]);

    // Save history
    useEffect(() => {
        if (user?.id && messages.length > 0) {
            localStorage.setItem(`teacher_assistant_chat_${user.id}`, JSON.stringify(messages));
        } else if (user?.id && messages.length === 0) {
            localStorage.removeItem(`teacher_assistant_chat_${user.id}`);
        }
    }, [messages, user?.id]);

    // Scroll to bottom
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        const context = {
            route: location.pathname,
            teacherName: profile?.full_name,
        };

        try {
            const { data, error } = await supabase.functions.invoke('teacher-assistant-chat', {
                body: {
                    messages: [...messages, userMsg].filter(m => m.role !== 'system'),
                    context
                }
            });

            if (error) {
                console.error('Supabase function error:', error);
                throw error;
            }

            if (data?.message) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
            }
        } catch (error) {
            console.error(error);
            toast.error(t('common.error') || 'Failed to get response');
            // Optionally remove the user message if failed? Or keep it with error state.
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        if (confirm(t('common.areYouSure') || 'Clear chat history?')) {
            setMessages([]);
        }
    };

    // Only show for teachers
    if (!user || user.user_metadata?.role !== 'teacher') return null;

    return (
        <>
            <Button
                className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} z-[9999] w-14 h-14 rounded-full shadow-2xl transition-all duration-500 hover:scale-110 active:scale-95 flex items-center justify-center overflow-hidden group border ${
                    isOpen 
                        ? 'bg-muted text-muted-foreground border-border' 
                        : 'bg-primary text-primary-foreground border-primary/20'
                }`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle AI Assistant"
            >
                {/* Background Glow Effect */}
                {!isOpen && (
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                )}
                
                {isOpen ? (
                    <X className="h-6 w-6 relative z-10" />
                ) : (
                    <div className="relative flex items-center justify-center w-full h-full">
                        <div className="absolute inset-0 animate-pulse bg-primary-foreground/10 rounded-full scale-110" />
                        <Sparkles className="h-7 w-7 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                    </div>
                )}
            </Button>

            {isOpen && (
                <Card className={`fixed bottom-24 ${isRTL ? 'left-6' : 'right-6'} w-[90vw] md:w-96 h-[550px] max-h-[80vh] shadow-2xl z-[9999] flex flex-col animate-in fade-in slide-in-from-bottom-8 zoom-in-95 duration-300 border-border/50 overflow-hidden rounded-2xl`} dir={isRTL ? 'rtl' : 'ltr'}>
                    <CardHeader className="flex flex-row items-center justify-between pb-3 py-4 border-b bg-muted/30">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <div className="p-2 bg-primary rounded-xl text-primary-foreground shadow-md">
                                <Sparkles className="h-4 w-4" />
                            </div>
                            <span className="text-foreground">
                                {t('teacherAssistant.title')}
                            </span>
                        </CardTitle>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={clearChat} title={t('teacherAssistant.clearChat')}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-hidden bg-muted/10">
                        <ScrollArea className="h-full p-4">
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
                                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${m.role === 'user'
                                                ? 'bg-primary text-primary-foreground rounded-br-none'
                                                : 'bg-card border border-border rounded-bl-none text-card-foreground'
                                            }`}>
                                            <SafeMathMarkdown content={m.content} />
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
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex w-full items-end gap-2"
                        >
                            <Input
                                placeholder={t('teacherAssistant.placeholder')}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={isLoading}
                                className="flex-1 rounded-xl bg-muted/50 border-border focus-visible:ring-ring min-h-[44px]"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={isLoading || !input.trim()}
                                className="h-11 w-11 rounded-xl shrink-0"
                            >
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className={`h-5 w-5 ${isRTL ? 'rotate-180' : ''}`} />}
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}
        </>
    );
}
