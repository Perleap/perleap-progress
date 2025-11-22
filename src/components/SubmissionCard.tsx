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
  };
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const hasConversation =
    submission.conversation_context && submission.conversation_context.length > 0;

  const initials = submission.student_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="group rounded-3xl border-none shadow-sm hover:shadow-md transition-all bg-white dark:bg-slate-900 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-800 shadow-sm">
              <AvatarFallback className="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
                  {submission.student_name}
                </CardTitle>
                <Badge
                  variant={submission.has_feedback ? 'default' : 'secondary'}
                  className={`rounded-full px-3 font-normal ${submission.has_feedback
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}
                >
                  {submission.has_feedback
                    ? t('submissionCard.completed')
                    : t('submissionCard.inProgress')}
                </Badge>
              </div>
              <CardDescription className="text-slate-600 dark:text-slate-400 truncate">
                {submission.assignment_title}
              </CardDescription>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('submissionCard.submitted')}: {new Date(submission.submitted_at).toLocaleString()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-colors"
            onClick={() => navigate(`/teacher/submission/${submission.id}`)}
          >
            <Eye className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      {submission.has_feedback && (
        <CardContent className="space-y-3 pt-0">
          {hasConversation && (
            <Collapsible open={isConversationOpen} onOpenChange={setIsConversationOpen} className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between px-4 py-3 h-auto hover:bg-slate-100 dark:hover:bg-slate-800/50">
                  <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                    <MessageSquare className="h-4 w-4 text-slate-400" />
                    {t('submissionCard.conversation')}
                  </div>
                  {isConversationOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 pt-0 space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                  {submission.conversation_context!.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                          ? 'bg-white dark:bg-slate-800 ml-8 shadow-sm border border-slate-100 dark:border-slate-700'
                          : 'bg-indigo-50 dark:bg-indigo-900/20 mr-8'
                        }`}
                    >
                      <div className="font-bold mb-1 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        {msg.role === 'user' ? (
                          <>
                            <User className="h-3 w-3" />
                            {submission.student_name}
                          </>
                        ) : (
                          <>
                            <span className="text-indigo-500">✦</span>
                            {t('submissionCard.ai')}
                          </>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{msg.content}</div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {submission.teacher_feedback && (
            <Collapsible open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between px-4 py-3 h-auto hover:bg-slate-100 dark:hover:bg-slate-800/50">
                  <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                    <User className="h-4 w-4 text-slate-400" />
                    {t('submissionCard.teacherFeedback')}
                  </div>
                  {isFeedbackOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 pt-0">
                  <div className="prose prose-sm max-w-none dark:prose-invert text-slate-600 dark:text-slate-300 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm whitespace-pre-wrap">
                    {submission.teacher_feedback?.replace(/\*\*/g, '')?.replace(/\/\//g, '')?.trim()}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      )}
    </Card>
  );
}
