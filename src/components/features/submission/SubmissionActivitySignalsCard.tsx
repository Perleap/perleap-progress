import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  AssignmentChatSentenceFlag,
  AssignmentClipboardEvent,
} from '@/services/submissionService';

export type ActivitySignalScrollTarget =
  | { kind: 'chat_sentence'; messageIndex: number; sentenceIndex: number }
  | { kind: 'chat_message'; messageIndex: number }
  | { kind: 'essay' }
  | { kind: 'test_question'; contextKey: string };

interface SubmissionActivitySignalsCardProps {
  sentenceFlags: AssignmentChatSentenceFlag[];
  clipboardEvents: AssignmentClipboardEvent[];
  uiLanguage: string;
  onScrollToTarget: (target: ActivitySignalScrollTarget) => void;
  className?: string;
}

function formatSourceLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  event: AssignmentClipboardEvent,
): string {
  const msgNum =
    event.message_index != null ? event.message_index + 1 : undefined;

  switch (event.source_kind) {
    case 'assistant_message':
      return t('submissionDetail.clipboard.sourceAssistant', { message: msgNum });
    case 'user_message':
      return t('submissionDetail.clipboard.sourceUserMessage', { message: msgNum });
    case 'chat_input':
      return t('submissionDetail.clipboard.sourceChatInput');
    case 'student_facing_task':
      return t('submissionDetail.clipboard.sourceStudentTask');
    case 'assignment_instructions':
      return t('submissionDetail.clipboard.sourceInstructions');
    case 'essay':
      return t('submissionDetail.clipboard.sourceEssay');
    case 'test_answer':
      return t('submissionDetail.clipboard.sourceTestAnswer', {
        question: event.context_key ?? '',
      });
    case 'langchain_field':
      return t('submissionDetail.clipboard.sourceLangchainField', {
        field: event.context_key ?? '',
      });
    default:
      return t('submissionDetail.clipboard.sourceUnknown');
  }
}

function clipboardScrollTarget(event: AssignmentClipboardEvent): ActivitySignalScrollTarget | null {
  if (event.event_type === 'copy') {
    if (
      event.source_kind === 'assistant_message' &&
      event.message_index != null &&
      event.sentence_index != null
    ) {
      return {
        kind: 'chat_sentence',
        messageIndex: event.message_index,
        sentenceIndex: event.sentence_index,
      };
    }
    if (event.source_kind === 'user_message' && event.message_index != null) {
      return { kind: 'chat_message', messageIndex: event.message_index };
    }
    return null;
  }

  if (event.event_type === 'paste') {
    if (event.linked_message_index != null) {
      return { kind: 'chat_message', messageIndex: event.linked_message_index };
    }
    if (event.source_kind === 'essay') {
      return { kind: 'essay' };
    }
    if (event.source_kind === 'test_answer' && event.context_key) {
      return { kind: 'test_question', contextKey: event.context_key };
    }
  }

  return null;
}

export function SubmissionActivitySignalsCard({
  sentenceFlags,
  clipboardEvents,
  uiLanguage,
  onScrollToTarget,
  className,
}: SubmissionActivitySignalsCardProps) {
  const { t } = useTranslation();

  if (sentenceFlags.length === 0 && clipboardEvents.length === 0) {
    return null;
  }

  const locale = uiLanguage === 'he' ? 'he-IL' : undefined;

  return (
    <Card
      className={cn(
        'rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden',
        className,
      )}
    >
      <CardHeader className="px-6 py-4 space-y-1">
        <CardTitle className="text-base font-semibold text-left">
          {t('submissionDetail.activitySignalsTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6 pt-0">
        {sentenceFlags.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground text-left">
              {t('submissionDetail.flaggedSentencesTitle')}
            </h3>
            {sentenceFlags.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() =>
                  onScrollToTarget({
                    kind: 'chat_sentence',
                    messageIndex: row.message_index,
                    sentenceIndex: row.sentence_index,
                  })
                }
                className={cn(
                  'w-full rounded-lg border border-slate-100 bg-slate-50/80 p-4 text-left',
                  'transition-colors hover:bg-slate-100/90 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800/70',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed text-slate-900 dark:text-slate-100">
                  {row.sentence_text}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString(locale, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </p>
              </button>
            ))}
          </div>
        ) : null}

        {clipboardEvents.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground text-left">
              {t('submissionDetail.clipboardActivityTitle')}
            </h3>
            {clipboardEvents.map((row) => {
              const isCopy = row.event_type === 'copy';
              const displayText =
                (isCopy ? row.copied_text : row.pasted_text)?.trim() ||
                row.sentence_text?.trim() ||
                '';
              const scrollTarget = clipboardScrollTarget(row);

              const inner = (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {isCopy
                        ? t('submissionDetail.clipboard.copiedBadge')
                        : t('submissionDetail.clipboard.pastedBadge')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatSourceLabel(t, row)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-slate-900 dark:text-slate-100">
                    {displayText}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString(locale, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </>
              );

              if (!scrollTarget) {
                return (
                  <div
                    key={row.id}
                    className="w-full rounded-lg border border-slate-100 bg-slate-50/80 p-4 text-left dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    {inner}
                  </div>
                );
              }

              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onScrollToTarget(scrollTarget)}
                  className={cn(
                    'w-full rounded-lg border border-slate-100 bg-slate-50/80 p-4 text-left',
                    'transition-colors hover:bg-slate-100/90 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800/70',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  )}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
