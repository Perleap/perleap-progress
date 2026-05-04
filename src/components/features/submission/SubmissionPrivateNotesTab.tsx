import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateSubmissionTeacherPrivateNoteEntry,
  useSubmissionTeacherPrivateNoteEntries,
} from '@/hooks/queries';
import { cn } from '@/lib/utils';

type SubmissionPrivateNotesTabProps = {
  submissionId: string;
  isRTL: boolean;
};

export function SubmissionPrivateNotesTab({
  submissionId,
  isRTL,
}: SubmissionPrivateNotesTabProps) {
  const { t } = useTranslation();
  const { data: entries, isLoading } = useSubmissionTeacherPrivateNoteEntries(submissionId);
  const createNote = useCreateSubmissionTeacherPrivateNoteEntry();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const handleSaveNew = async () => {
    const body = draft.trim();
    if (!body) {
      toast.error(t('submissionDetail.interactionNotes.empty'));
      return;
    }
    try {
      await createNote.mutateAsync({ submissionId, body });
      toast.success(t('submissionDetail.interactionNotes.added'));
      setDraft('');
      setDialogOpen(false);
    } catch {
      toast.error(t('common.error'));
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <div className={cn('flex w-full', isRTL ? 'justify-start' : 'justify-end')}>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="shrink-0 rounded-full border-border shadow-sm"
          aria-label={t('submissionDetail.interactionNotes.add')}
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : !entries?.length ? (
        <Card className="rounded-xl border-dashed border-border bg-muted/10">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('submissionDetail.interactionNotes.emptyState')}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3 list-none p-0 m-0">
          {entries.map((row) => (
            <li key={row.id}>
              <Card className="rounded-xl border border-border/80 shadow-sm">
                <CardHeader className="py-3 px-4 space-y-0.5">
                  <CardDescription className="text-xs font-medium uppercase tracking-tight">
                    {t('submissionDetail.interactionNotes.recorded')}{' '}
                    {new Date(row.created_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 px-4 pb-4">
                  <p className="text-sm text-foreground whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {row.body}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto gap-4"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <DialogHeader>
            <DialogTitle>{t('submissionDetail.interactionNotes.addTitle')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[280px] sm:min-h-[360px] w-full resize-y text-sm rounded-lg"
            placeholder={t('submissionDetail.interactionNotes.placeholder')}
          />
          <DialogFooter className={cn('gap-2', isRTL && 'flex-row-reverse')}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDialogOpen(false);
                setDraft('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void handleSaveNew()} disabled={createNote.isPending}>
              {createNote.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              ) : null}
              {t('submissionDetail.interactionNotes.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
