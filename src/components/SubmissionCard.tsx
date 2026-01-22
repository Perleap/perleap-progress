import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Eye, ChevronDown, ChevronUp, MessageSquare, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SubmissionCardProps {
  submission: {
    id: string;
    submitted_at: string;
    student_name: string;
    assignment_title: string;
    status: 'in_progress' | 'completed';
    has_feedback: boolean;
    teacher_feedback?: string;
    conversation_context?: ConversationMessage[];
    student_avatar_url?: string;
  };
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showFeedback, setShowFeedback] = useState(false);

  const initials = submission.student_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="group rounded-xl border-none shadow-sm hover:shadow-md transition-all bg-card ring-1 ring-border overflow-hidden flex flex-col h-[400px] relative">
      {/* Status Badge - Absolute Top Right */}
      <div className="absolute top-4 right-4 z-10">
    <Badge
      variant={submission.has_feedback ? 'default' : 'secondary'}
      className={`rounded-full px-2.5 py-0.5 font-medium text-[10px] shadow-sm backdrop-blur-sm ${submission.has_feedback
        ? 'bg-success/20 text-success dark:bg-success/30 dark:text-success-foreground'
        : 'bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-400'
        }`}
    >
      {submission.has_feedback
        ? t('submissionCard.completed')
        : t('submissionCard.inProgress')}
    </Badge>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col items-center text-center p-6 transition-opacity duration-300 ${showFeedback ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <Avatar className="h-24 w-24 rounded-full border-4 border-card shadow-sm mb-4 ring-1 ring-border overflow-hidden">
          <AvatarImage src={submission.student_avatar_url} alt={submission.student_name} className="h-full w-full object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">
            {initials}
          </AvatarFallback>
        </Avatar>

        <CardTitle className="text-xl font-bold text-foreground truncate w-full px-2 mb-1">
          {submission.student_name}
        </CardTitle>

        <CardDescription className="text-muted-foreground truncate w-full px-2 text-sm font-medium mb-4">
          {submission.assignment_title}
        </CardDescription>

        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30"></span>
          {new Date(submission.submitted_at).toLocaleDateString()}
        </p>

        {submission.has_feedback && submission.teacher_feedback && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFeedback(true)}
            className="mt-auto text-primary hover:text-primary/80 hover:bg-primary/10"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {t('submissionCard.teacherFeedback')}
          </Button>
        )}
      </div>

      {/* Feedback Overlay */}
      <div
        className={`absolute inset-0 bg-card/95 backdrop-blur-sm z-20 flex flex-col p-6 transition-all duration-300 transform ${showFeedback ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            {t('submissionCard.teacherFeedback')}
          </h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-muted"
            onClick={() => setShowFeedback(false)}
          >
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
          <div className="prose prose-sm max-w-none dark:prose-invert text-foreground/80 whitespace-pre-wrap">
            {submission.teacher_feedback?.replace(/\*\*/g, '')?.replace(/\/\//g, '')?.trim()}
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-4 pt-0 z-30 bg-card">
        <Button
          onClick={() => navigate(`/teacher/submission/${submission.id}`)}
          disabled={submission.id.startsWith('pending-')}
          className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md transition-all h-11 text-sm font-medium"
        >
          {submission.id.startsWith('pending-') ? t('submissionCard.notStarted') : t('submissionCard.fullReport', 'Full Report')}
        </Button>
      </div>
    </Card>
  );
}
