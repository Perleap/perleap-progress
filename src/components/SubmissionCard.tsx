import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Eye, ChevronDown, ChevronUp } from "lucide-react";

interface SubmissionCardProps {
  submission: {
    id: string;
    submitted_at: string;
    student_name: string;
    assignment_title: string;
    has_feedback: boolean;
    teacher_feedback?: string;
    conversation_context?: any[];
  };
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
  const navigate = useNavigate();
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const hasConversation = submission.conversation_context && submission.conversation_context.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg">{submission.student_name}</CardTitle>
            <CardDescription>{submission.assignment_title}</CardDescription>
            <p className="text-sm text-muted-foreground">
              Submitted: {new Date(submission.submitted_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={submission.has_feedback ? 'default' : 'secondary'}>
              {submission.has_feedback ? 'Completed' : 'In Progress'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/teacher/submission/${submission.id}`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {submission.has_feedback && (
        <CardContent className="space-y-4">
          {hasConversation && (
            <Collapsible open={isConversationOpen} onOpenChange={setIsConversationOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span className="font-semibold">Conversation History</span>
                  {isConversationOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {submission.conversation_context!.map((msg: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary/10 ml-8'
                          : 'bg-muted mr-8'
                      }`}
                    >
                      <div className="font-semibold mb-1 text-xs">
                        {msg.role === 'user' ? submission.student_name : 'Perleap AI'}
                      </div>
                      <div className="whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {submission.teacher_feedback && (
            <Collapsible open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span className="font-semibold">Teacher Feedback</span>
                  {isFeedbackOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="prose prose-sm max-w-none text-muted-foreground p-4 bg-muted/50 rounded-lg whitespace-pre-wrap">
                  {submission.teacher_feedback
                    ?.replace(/\*\*/g, '')
                    ?.replace(/\/\//g, '')
                    ?.trim()}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      )}
    </Card>
  );
}
