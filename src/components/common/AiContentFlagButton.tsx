import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  reportTeacherAiContentFlag,
  type TeacherAiContentType,
} from '@/services/submissionService';

type AiContentFlagButtonProps = {
  contentType: TeacherAiContentType;
  contentExcerpt: string;
  opikTraceId?: string;
  assignmentId?: string;
  submissionId?: string;
  className?: string;
};

export function AiContentFlagButton({
  contentType,
  contentExcerpt,
  opikTraceId,
  assignmentId,
  submissionId,
  className,
}: AiContentFlagButtonProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  if (!opikTraceId?.trim() && !assignmentId && !submissionId) {
    return null;
  }

  const handleClick = async () => {
    const excerpt = contentExcerpt.trim();
    if (!excerpt) {
      toast.warning(t('aiContentFlag.emptyContent'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await reportTeacherAiContentFlag({
        assignmentId,
        submissionId,
        contentType,
        contentExcerpt: excerpt,
        opikTraceId,
      });
      if (result.ok) {
        toast.success(t('aiContentFlag.success'));
      } else if (result.duplicate) {
        toast.info(t('aiContentFlag.duplicate'));
      } else {
        toast.error(t('aiContentFlag.error'));
      }
    } catch {
      toast.error(t('aiContentFlag.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className ?? 'h-8 w-8 p-0 shrink-0'}
      title={t('aiContentFlag.title')}
      aria-label={t('aiContentFlag.title')}
      disabled={submitting}
      onClick={() => void handleClick()}
    >
      {submitting ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Flag className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}

export function readOpikTraceId(raw: unknown, key: string): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
