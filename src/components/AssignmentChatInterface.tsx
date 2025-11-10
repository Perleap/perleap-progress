import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
  onComplete 
}: AssignmentChatInterfaceProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const generateInitialGreeting = useCallback(async () => {
    setLoading(true);
    try {
      const { data: promptData, error: promptError } = await supabase
        .from('ai_prompts')
        .select('prompt_template')
        .eq('prompt_key', 'chat_initial_greeting')
        .eq('is_active', true)
        .single();

      if (promptError) throw promptError;

      const { data, error } = await supabase.functions.invoke('perleap-chat', {
        body: {
          message: promptData.prompt_template,
          assignmentInstructions,
          submissionId,
          studentId: user!.id,
          assignmentId,
          isInitialGreeting: true
        }
      });

      if (error) throw error;

      setMessages([{ role: 'assistant', content: data.message }]);
    } catch {
      toast.error('Error starting conversation');
    } finally {
      setLoading(false);
    }
  }, [assignmentId, assignmentInstructions, submissionId, user]);

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
    } catch {
      toast.error('Error loading conversation');
    }
  }, [submissionId, generateInitialGreeting]);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      loadConversation();
    }

    return () => {
      hasInitialized.current = false;
    };
  }, [submissionId, loadConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    const messageText = input.trim();
    if (!messageText) return;

    setMessages(prev => [...prev, { role: 'user', content: messageText }]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('perleap-chat', {
        body: {
          message: messageText,
          assignmentInstructions,
          submissionId,
          studentId: user!.id,
          assignmentId
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch {
      toast.error('Error communicating with Perleap agent');
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
          assignmentId
        }
      });

      if (error) throw error;

      toast.success('Activity completed! Your feedback has been generated.');
      onComplete();
    } catch {
      toast.error('Error generating feedback');
    } finally {
      setCompleting(false);
    }
  };

  const isDisabled = loading || completing;
  const canComplete = messages.length >= 2 && !completing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{teacherName} - {assignmentTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              return (
                <div
                  key={index}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
          </div>
        </ScrollArea>

        <div className="flex gap-2 items-end">
          <Textarea
            placeholder="Type your message..."
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Feedback...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete Activity & Get Feedback
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}