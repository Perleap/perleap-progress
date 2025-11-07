import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  useEffect(() => {
    // Reset initialization flag when submissionId changes
    hasInitialized.current = false;
    
    // Prevent double initialization from React Strict Mode
    const initializeConversation = async () => {
      if (!hasInitialized.current) {
        hasInitialized.current = true;
        await loadConversation();
      }
    };
    
    initializeConversation();
  }, [submissionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('assignment_conversations')
        .select('messages')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        // Load existing conversation from database
        setMessages(data.messages as unknown as Message[]);
      } else {
        // No conversation exists, generate initial AI greeting
        await initializeConversation();
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error('Error loading conversation');
    }
  };

  const initializeConversation = async () => {
    setLoading(true);
    try {
      // Request an initial greeting from the AI without a user message
      const { data, error } = await supabase.functions.invoke('perleap-chat', {
        body: {
          message: "[System: This is the start of the conversation. Please greet the student warmly and introduce yourself.]",
          assignmentInstructions,
          submissionId,
          studentId: user!.id,
          assignmentId,
          teacherName,
          isInitialGreeting: true
        }
      });

      if (error) throw error;

      // Only add the AI greeting, no user message
      const aiMessage: Message = { role: 'assistant', content: data.message };
      setMessages([aiMessage]);
    } catch (error: any) {
      console.error('Error initializing conversation:', error);
      toast.error('Error starting conversation');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (messageText: string = input, isInit = false) => {
    if (!messageText.trim() && !isInit) return;

    const userMessage: Message = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    if (!isInit) setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('perleap-chat', {
        body: {
          message: messageText,
          assignmentInstructions,
          submissionId,
          studentId: user!.id,
          assignmentId,
          teacherName
        }
      });

      if (error) throw error;

      const aiMessage: Message = { role: 'assistant', content: data.message };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Error communicating with Perleap agent');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      // Fetch student profile for actual name
      const { data: studentProfile } = await supabase
        .from('student_profiles')
        .select('full_name')
        .eq('user_id', user!.id)
        .maybeSingle();

      // Fetch assignment to get classroom and teacher info
      const { data: assignment } = await supabase
        .from('assignments')
        .select('classroom_id')
        .eq('id', assignmentId)
        .single();

      let actualTeacherName = teacherName || 'Teacher';
      if (assignment) {
        const { data: classroom } = await supabase
          .from('classrooms')
          .select('teacher_id')
          .eq('id', assignment.classroom_id)
          .single();

        if (classroom) {
          const { data: teacherProfile } = await supabase
            .from('teacher_profiles')
            .select('full_name')
            .eq('user_id', classroom.teacher_id)
            .maybeSingle();
          
          if (teacherProfile?.full_name) {
            actualTeacherName = teacherProfile.full_name;
          }
        }
      }

      const { data, error } = await supabase.functions.invoke('generate-feedback', {
        body: {
          submissionId,
          studentId: user!.id,
          assignmentId,
          studentName: studentProfile?.full_name || user?.email || 'Student',
          teacherName: actualTeacherName
        }
      });

      if (error) throw error;

      toast.success('Activity completed! Your feedback has been generated.');
      onComplete();
    } catch (error: any) {
      console.error('Error completing activity:', error);
      toast.error('Error generating feedback');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{teacherName} - {assignmentTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !loading && sendMessage()}
            disabled={loading || completing}
          />
          <Button onClick={() => sendMessage()} disabled={loading || completing || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        <Button 
          onClick={handleComplete} 
          disabled={completing || messages.length < 2} 
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