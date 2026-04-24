import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

function stripFeedbackPreview(s: string, max: number) {
  const plain = s.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max)}…`;
}

function lastChatSnippet(messages: ConversationMessage[] | undefined, max: number) {
  if (!messages?.length) return '';
  const last = [...messages].reverse().find((m) => m.content?.trim());
  if (!last?.content) return '';
  const plain = last.content.replace(/\n/g, ' ').trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max)}…`;
}

export type SubmissionCardVariant = 'stack' | 'compact' | 'detailed' | 'list';

/** Shown only when a student has more than one submission row for the same assignment. */
export function formatSubmissionAssignmentTitle(
  assignmentTitle: string,
  attemptNumber: number | undefined,
  submissionAttemptCount: number,
): string {
  if (typeof attemptNumber !== 'number') return assignmentTitle;
  if (submissionAttemptCount <= 1) return assignmentTitle;
  return `${assignmentTitle} #${attemptNumber}`;
}

interface SubmissionCardProps {
  submission: {
    id: string;
    submitted_at: string;
    student_name: string;
    assignment_title: string;
    attempt_number?: number;
    status: 'in_progress' | 'completed';
    has_feedback: boolean;
    teacher_feedback?: string;
    conversation_context?: ConversationMessage[];
    student_avatar_url?: string;
  };
  /** Total submission rows for this student + assignment in the classroom (from the same query). */
  submissionAttemptCount?: number;
  /** Default stack: tall card with title top, student bottom-left, date bottom-right */
  variant?: SubmissionCardVariant;
}

export function SubmissionCard({
  submission,
  submissionAttemptCount = 1,
  variant = 'stack',
}: SubmissionCardProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const showDetails = variant !== 'list';
  /** Detailed layout + timeline use richer metadata and larger type */
  const isRich = variant === 'detailed';
  const msgCount = submission.conversation_context?.length ?? 0;
  const feedbackMaxLen = isRich ? 280 : 160;
  const chatPreviewMax = isRich ? 140 : 0;

  const feedbackPreview = useMemo(() => {
    if (!submission.teacher_feedback?.trim()) return '';
    return stripFeedbackPreview(submission.teacher_feedback, feedbackMaxLen);
  }, [submission.teacher_feedback, feedbackMaxLen]);

  const chatPreview = useMemo(
    () => (isRich && chatPreviewMax > 0 ? lastChatSnippet(submission.conversation_context, chatPreviewMax) : ''),
    [isRich, submission.conversation_context, chatPreviewMax],
  );

  const initials = submission.student_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const pending = submission.id.startsWith('pending-');

  const displayAssignmentTitle = formatSubmissionAssignmentTitle(
    submission.assignment_title,
    submission.attempt_number,
    submissionAttemptCount,
  );

  const avatarClass =
    variant === 'list' || variant === 'compact'
      ? 'h-9 w-9'
      : variant === 'detailed'
        ? 'h-11 w-11'
        : 'h-10 w-10';

  const titleClass = cn(
    'font-bold text-foreground leading-snug line-clamp-2 min-w-0 flex-1',
    variant === 'detailed' && 'text-xl sm:text-2xl',
    variant === 'compact' && 'text-base',
    variant === 'stack' && 'text-lg',
  );

  const detailRowClass = cn(
    'flex items-start gap-2 text-muted-foreground',
    isRich ? 'text-base' : 'text-sm',
  );
  const detailIconClass = cn('shrink-0', isRich ? 'h-4 w-4 mt-1' : 'h-4 w-4 mt-0.5');

  const studentBlock = (
    <div className="flex items-center gap-2 min-w-0 justify-start">
      <Avatar
        className={cn(
          avatarClass,
          'shrink-0 rounded-full border-2 border-border shadow-sm overflow-hidden',
        )}
      >
        <AvatarImage src={submission.student_avatar_url} alt="" className="h-full w-full object-cover" />
        <AvatarFallback
          className={cn(
            'bg-primary/10 text-primary font-bold',
            variant === 'compact' || variant === 'list' ? 'text-xs' : 'text-sm',
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <span
        className={cn(
          'font-medium text-foreground truncate',
          variant === 'list' && 'text-sm sm:text-base',
          variant !== 'list' && (isRich ? 'text-base sm:text-lg' : 'text-base'),
        )}
      >
        {submission.student_name}
      </span>
    </div>
  );

  const dateBlock = (
    <time
      className={cn(
        'text-muted-foreground tabular-nums shrink-0',
        variant === 'list' && 'text-sm sm:text-base font-medium',
        variant !== 'list' && (isRich ? 'text-sm sm:text-base' : 'text-sm'),
      )}
      dateTime={submission.submitted_at}
    >
      {new Date(submission.submitted_at).toLocaleDateString()}
    </time>
  );

  const statusBadge = (
    <Badge
      variant={submission.has_feedback ? 'default' : 'secondary'}
      className={cn(
        'shrink-0 rounded-full px-2.5 py-0.5 font-medium text-xs',
        submission.has_feedback
          ? 'bg-success/20 text-success dark:bg-success/30 dark:text-success-foreground'
          : 'bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-400',
      )}
    >
      {pending ? t('submissionCard.notStarted') : submission.has_feedback ? t('submissionCard.completed') : t('submissionCard.inProgress')}
    </Badge>
  );

  const topRow = (
    <div className="flex items-start justify-between gap-3">
      <h3 className={titleClass}>{displayAssignmentTitle}</h3>
      {statusBadge}
    </div>
  );

  const detailsBlock =
    showDetails && (
      <div className={cn('w-full text-start space-y-2', isRich && 'space-y-3')}>
        <p className={detailRowClass}>
          <Clock className={detailIconClass} aria-hidden />
          <span className="leading-snug">
            {new Date(submission.submitted_at).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        </p>
        {!pending && (
          <p className={detailRowClass}>
            <MessageSquare className={detailIconClass} aria-hidden />
            <span>{t('submissionCard.chatMessages', { count: msgCount })}</span>
          </p>
        )}
        {isRich && !pending && chatPreview && (
          <p className={detailRowClass}>
            <MessageSquare className={detailIconClass} aria-hidden />
            <span>
              <span className="font-medium text-foreground/90">{t('submissionCard.latestInChat')} </span>
              <span className="line-clamp-4 text-foreground/80">{chatPreview}</span>
            </span>
          </p>
        )}
        <p
          className={cn(
            'leading-snug text-muted-foreground',
            isRich ? 'text-base' : 'text-sm',
          )}
        >
          <span className={cn('font-medium text-foreground', isRich && 'text-foreground')}>
            {t('submissionCard.feedbackLabel')}{' '}
          </span>
          {pending ? (
            <span>{t('submissionCard.notStarted')}</span>
          ) : submission.has_feedback ? (
            feedbackPreview ? (
              <span className={cn('text-foreground/90', isRich ? 'line-clamp-6' : 'line-clamp-3')}>
                {feedbackPreview}
              </span>
            ) : (
              <span>{t('submissionCard.feedbackRecorded')}</span>
            )
          ) : (
            <span>{t('submissionCard.awaitingFeedback')}</span>
          )}
        </p>
      </div>
    );

  const bottomRow = (
    <div className="flex w-full justify-between items-center gap-3">
      {studentBlock}
      {dateBlock}
    </div>
  );

  const isList = variant === 'list';

  const listAvatar = (
    <Avatar
      className={cn(
        'h-10 w-10 shrink-0 rounded-full border-2 border-border bg-muted/40 shadow-sm overflow-hidden',
      )}
    >
      <AvatarImage src={submission.student_avatar_url} alt="" className="h-full w-full object-cover" />
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
    </Avatar>
  );

  const listRow = (
    <div className="flex w-full items-center gap-3">
      <div className="shrink-0">{listAvatar}</div>
      <div className="min-w-0 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <h3 className="min-w-0 flex-1 text-start font-semibold leading-snug text-foreground line-clamp-2 text-base sm:text-[1.0625rem]">
            {displayAssignmentTitle}
          </h3>
          <div className="shrink-0 pt-0.5">{statusBadge}</div>
        </div>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <p className="text-start text-sm text-muted-foreground truncate min-w-0 flex-1 pe-2">
            {submission.student_name}
          </p>
          <time
            className="shrink-0 tabular-nums text-sm font-medium text-muted-foreground whitespace-nowrap"
            dateTime={submission.submitted_at}
          >
            {new Date(submission.submitted_at).toLocaleDateString()}
          </time>
        </div>
      </div>
    </div>
  );

  return (
    <button
      type="button"
      dir={isRTL ? 'rtl' : 'ltr'}
      disabled={pending}
      onClick={() => navigate(`/teacher/submission/${submission.id}`)}
      className={cn(
        'w-full text-start flex flex-col transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-60 disabled:pointer-events-none cursor-pointer disabled:cursor-not-allowed',
        isList &&
          'flex-none h-auto rounded-xl border border-border/80 bg-card p-4 shadow-sm hover:border-border hover:bg-muted/20 hover:shadow-md sm:p-4',
        !isList && 'rounded-xl border-none shadow-sm hover:shadow-md transition-all bg-card ring-1 ring-border',
        isList && 'min-h-0',
        !isList && variant === 'compact' && 'gap-3 p-4 min-h-[280px]',
        !isList && variant === 'detailed' && 'gap-6 p-6 sm:p-8 min-h-[480px]',
        !isList && variant === 'stack' && 'gap-4 p-5 sm:p-6 min-h-[400px]',
      )}
    >
      {isList ? (
        listRow
      ) : (
        <>
          {topRow}
          {detailsBlock}
          <div className={cn('flex-1 w-full', isRich ? 'min-h-[2rem]' : 'min-h-[3rem]')} aria-hidden />
          <div className="mt-auto w-full pt-1">{bottomRow}</div>
        </>
      )}
    </button>
  );
}
