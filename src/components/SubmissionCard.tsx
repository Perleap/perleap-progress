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
  };
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

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
      
      {submission.has_feedback && submission.teacher_feedback && (
        <CardContent>
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="font-semibold">Teacher Feedback Preview</span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <div className="prose prose-sm max-w-none text-muted-foreground p-4 bg-muted/50 rounded-lg">
                {submission.teacher_feedback
                  ?.replace(/\*\*/g, '')
                  ?.replace(/\/\//g, '')
                  ?.trim()
                  .split('\n')
                  .slice(0, 5)
                  .join('\n')}
                {submission.teacher_feedback.split('\n').length > 5 && '...'}
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate(`/teacher/submission/${submission.id}`)}
                className="mt-2"
              >
                View Full Details
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      )}
    </Card>
  );
}
