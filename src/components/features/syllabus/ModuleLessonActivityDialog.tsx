import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCreateLessonActivity, useUpdateSectionResource } from '@/hooks/queries';
import {
  legacyLessonToBlocks,
  lessonBlocksHaveContent,
  parseLessonContent,
  toPersistedLessonContent,
} from '@/lib/lessonContent';
import { lessonHtmlToPlainText, plainRephraseToLessonHtml } from '@/lib/lessonRichText';
import type { LessonBlockV1, SectionResource } from '@/types/syllabus';
import { cn } from '@/lib/utils';
import { LessonBlocksEditor } from './LessonBlocksEditor';

const lessonActivityDraftKey = (classroomId: string, sectionId: string) =>
  `perleap:lesson-activity-draft:${classroomId}:${sectionId}`;

export interface ModuleLessonActivityDialogProps {
  classroomId: string;
  isRTL: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active section when dialog is open; null closes. */
  sectionId: string | null;
  /** Null = create new lesson; set = edit existing resource. */
  editingLesson: SectionResource | null;
  sectionResourcesBySection: Record<string, SectionResource[]>;
  /** Called after a new lesson is created successfully (not on edit). */
  onLessonCreated?: (resourceId: string) => void | Promise<void>;
}

export function ModuleLessonActivityDialog({
  classroomId,
  isRTL,
  open,
  onOpenChange,
  sectionId,
  editingLesson,
  sectionResourcesBySection,
  onLessonCreated,
}: ModuleLessonActivityDialogProps) {
  const { t } = useTranslation();
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonBlocks, setLessonBlocks] = useState<LessonBlockV1[]>([]);
  const [rephrasingBlockId, setRephrasingBlockId] = useState<string | null>(null);
  const [videoUploadBusy, setVideoUploadBusy] = useState(false);
  const draftWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createLesson = useCreateLessonActivity();
  const updateResource = useUpdateSectionResource();

  useEffect(() => {
    if (!open || !sectionId) return;
    if (editingLesson) {
      setLessonTitle(editingLesson.title);
      const parsed = parseLessonContent(editingLesson.lesson_content as unknown);
      if (parsed?.blocks?.length) {
        setLessonBlocks(parsed.blocks);
      } else {
        setLessonBlocks(legacyLessonToBlocks(editingLesson));
      }
      setRephrasingBlockId(null);
      setVideoUploadBusy(false);
    } else {
      setRephrasingBlockId(null);
      setVideoUploadBusy(false);
      try {
        const raw = sessionStorage.getItem(lessonActivityDraftKey(classroomId, sectionId));
        if (raw) {
          const parsed = JSON.parse(raw) as { lessonTitle?: string; lessonBlocks?: LessonBlockV1[] };
          const title = typeof parsed.lessonTitle === 'string' ? parsed.lessonTitle : '';
          const blocks = Array.isArray(parsed.lessonBlocks) ? parsed.lessonBlocks : [];
          if (title.trim() || blocks.length > 0) {
            setLessonTitle(title);
            setLessonBlocks(blocks);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      setLessonTitle('');
      setLessonBlocks([]);
    }
  }, [open, sectionId, editingLesson?.id, classroomId]);

  useEffect(() => {
    if (!open || !sectionId || editingLesson) return;
    if (draftWriteTimerRef.current) clearTimeout(draftWriteTimerRef.current);
    draftWriteTimerRef.current = setTimeout(() => {
      draftWriteTimerRef.current = null;
      try {
        const payload = JSON.stringify({ lessonTitle, lessonBlocks });
        if (payload.length > 4 * 1024 * 1024) return;
        sessionStorage.setItem(lessonActivityDraftKey(classroomId, sectionId), payload);
      } catch {
        /* quota */
      }
    }, 400);
    return () => {
      if (draftWriteTimerRef.current) clearTimeout(draftWriteTimerRef.current);
    };
  }, [open, sectionId, editingLesson, classroomId, lessonTitle, lessonBlocks]);

  const handleRephraseBlock = async (blockId: string) => {
    const block = lessonBlocks.find((b) => b.id === blockId);
    const plain = block && block.type === 'text' ? lessonHtmlToPlainText(block.body) : '';
    if (!block || block.type !== 'text' || !plain.trim()) {
      toast.error(t('createAssignment.rephraseError'));
      return;
    }
    setRephrasingBlockId(blockId);
    try {
      const { data, error } = await supabase.functions.invoke('rephrase-text', {
        body: {
          text: plain,
          language: isRTL ? 'he' : 'en',
        },
      });
      if (error) throw error;
      if (data?.rephrasedText) {
        setLessonBlocks((prev) =>
          prev.map((b) =>
            b.id === blockId && b.type === 'text'
              ? { ...b, body: plainRephraseToLessonHtml(data.rephrasedText) }
              : b
          )
        );
        toast.success(t('createAssignment.rephraseSuccess'));
      }
    } catch (err) {
      console.error('Error rephrasing lesson block:', err);
      toast.error(t('createAssignment.rephraseError'));
    } finally {
      setRephrasingBlockId(null);
    }
  };

  const resetAndClose = () => {
    setLessonTitle('');
    setLessonBlocks([]);
    setRephrasingBlockId(null);
    setVideoUploadBusy(false);
    onOpenChange(false);
  };

  const submitLesson = async () => {
    if (!sectionId || !lessonTitle.trim()) {
      toast.error(t('classroomDetail.activities.textTitleRequired'));
      return;
    }
    if (!lessonBlocksHaveContent(lessonBlocks)) {
      toast.error(t('classroomDetail.activities.activityNeedsContent'));
      return;
    }

    const lesson_content = toPersistedLessonContent(lessonBlocks);
    const allRes = sectionResourcesBySection[sectionId] ?? [];
    const orderIndex = editingLesson ? editingLesson.order_index : allRes.length;

    try {
      if (editingLesson) {
        await updateResource.mutateAsync({
          resourceId: editingLesson.id,
          sectionId,
          classroomId,
          updates: {
            title: lessonTitle.trim(),
            summary: null,
            lesson_content,
            body_text: null,
            url: null,
            file_path: null,
            mime_type: null,
            file_size: null,
            status: 'published',
            resource_type: 'lesson',
          },
        });
        toast.success(t('classroomDetail.activities.saved'));
      } else {
        const created = await createLesson.mutateAsync({
          sectionId,
          classroomId,
          title: lessonTitle.trim(),
          summary: null,
          lesson_content,
          body_text: null,
          status: 'published',
          orderIndex,
          url: null,
          file_path: null,
          mime_type: null,
          file_size: null,
        });
        toast.success(t('classroomDetail.activities.activitySaved'));
        if (created?.id) {
          try {
            sessionStorage.removeItem(lessonActivityDraftKey(classroomId, sectionId));
          } catch {
            /* ignore */
          }
          await onLessonCreated?.(created.id);
        }
      }
      resetAndClose();
    } catch {
      toast.error(t('classroomDetail.activities.saveFailed'));
    }
  };

  const saveDisabled =
    videoUploadBusy || !!rephrasingBlockId || createLesson.isPending || updateResource.isPending;
  const editorDisabled = createLesson.isPending || updateResource.isPending;

  const onUploadStateChange = useCallback((busy: boolean) => {
    setVideoUploadBusy(busy);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[92vh] h-[min(92vh,880px)] w-[95vw] flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-2xl sm:max-w-6xl',
          isRTL && 'text-right'
        )}
        showCloseButton
      >
        <div className="flex-shrink-0 border-b border-border px-6 pb-4 pt-6">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingLesson
                ? t('classroomDetail.activities.activityEdit')
                : t('classroomDetail.activities.activityCreate')}
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-6 py-5 pb-12 [overflow-anchor:none]">
          <div className="space-y-5">
            <div>
              <Label>{t('classroomDetail.activities.fieldTitle')}</Label>
              <Input
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('classroomDetail.activities.fieldBody')}</Label>
              {sectionId ? (
                <LessonBlocksEditor
                  key={`${sectionId}-${editingLesson?.id ?? 'new'}`}
                  sectionId={sectionId}
                  blocks={lessonBlocks}
                  onChange={setLessonBlocks}
                  isRTL={isRTL}
                  disabled={editorDisabled}
                  onRephraseBlock={handleRephraseBlock}
                  rephrasingBlockId={rephrasingBlockId}
                  onUploadStateChange={onUploadStateChange}
                />
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-border px-6 py-4">
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={editorDisabled}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void submitLesson()} disabled={saveDisabled}>
              {(createLesson.isPending || updateResource.isPending) && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              )}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
