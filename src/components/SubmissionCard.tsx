import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Eye, ChevronDown, ChevronUp, MessageSquare, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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
    <Card className="group rounded-3xl border-none shadow-sm hover:shadow-md transition-all bg-white dark:bg-slate-900 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden flex flex-col h-[320px] relative">
      {/* Status Badge - Absolute Top Right */}
      <div className="absolute top-4 right-4 z-10">
        <Badge
          variant={submission.has_feedback ? 'default' : 'secondary'}
          className={`rounded-full px-2.5 py-0.5 font-medium text-[10px] shadow-sm backdrop-blur-sm ${submission.has_feedback
            ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
            : 'bg-amber-100/80 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
            }`}
        >
          {submission.has_feedback
            ? t('submissionCard.completed')
            : t('submissionCard.inProgress')}
        </Badge>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col items-center text-center p-6 transition-opacity duration-300 ${showFeedback ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <Avatar className="h-24 w-24 border-4 border-white dark:border-slate-800 shadow-sm mb-4 ring-1 ring-slate-100 dark:ring-slate-800">
          {submission.student_avatar_url ? (
            <img src={submission.student_avatar_url} alt={submission.student_name} className="h-full w-full object-cover" />
          ) : (
            <AvatarFallback className="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 font-bold text-2xl">
              {initials}
            </AvatarFallback>
          )}
        </Avatar>

        <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate w-full px-2 mb-1">
          {submission.student_name}
        </CardTitle>

        <CardDescription className="text-slate-600 dark:text-slate-400 truncate w-full px-2 text-sm font-medium mb-4">
          {submission.assignment_title}
        </CardDescription>

        <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
          {new Date(submission.submitted_at).toLocaleDateString()}
        </p>

        {submission.has_feedback && submission.teacher_feedback && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFeedback(true)}
            className="mt-auto text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 -mb-2"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {t('submissionCard.teacherFeedback')}
          </Button>
        )}
      </div>

      {/* Feedback Overlay */}
      <div
        className={`absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-20 flex flex-col p-6 transition-all duration-300 transform ${showFeedback ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <User className="h-4 w-4 text-indigo-500" />
            {t('submissionCard.teacherFeedback')}
          </h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setShowFeedback(false)}
          >
            <ChevronDown className="h-5 w-5 text-slate-500" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
          <div className="prose prose-sm max-w-none dark:prose-invert text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
            {submission.teacher_feedback?.replace(/\*\*/g, '')?.replace(/\/\//g, '')?.trim()}
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-4 pt-0 z-30 bg-white dark:bg-slate-900">
        <Button
          onClick={() => navigate(`/teacher/submission/${submission.id}`)}
          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md transition-all h-11 text-sm font-medium"
        >
          Full Report
        </Button>
      </div>
    </Card>
  );
}
