import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { USER_ROLES } from '@/config/constants';
import { classroomKeys } from '@/hooks/queries/useClassroomQueries';
import { assignmentKeys } from '@/hooks/queries/useAssignmentQueries';
import { syllabusKeys, resourceKeys } from '@/hooks/queries/useSyllabusQueries';
import { moduleFlowKeys } from '@/hooks/queries/useModuleFlowQueries';
import {
  buildExportPackageForClassroom,
  mergeCoursePackageIntoClassroom,
  importCoursePackageV1,
} from '@/services/coursePackageService';
import { parseCoursePackageJson } from '@/lib/coursePackage/validateCoursePackage';
import { COURSE_PACKAGE_VERSION_V2 } from '@/types/coursePackage';
import type { PerleapCoursePackageAny, PerleapCoursePackageV1, PerleapCoursePackageV2 } from '@/types/coursePackage';
import { packageForNewClassroomFromAny } from '@/services/coursePackageNewImportUtils';
import { getMergeFailureFromApiError } from '@/types/api.types';
import { cn } from '@/lib/utils';
import { buildRoute } from '@/config/routes';

function safeFileSlug(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 72) || 'course'
  );
}

export function CoursePackageCard({
  classroomId,
  classroomName,
  isRTL,
}: {
  classroomId: string;
  classroomName: string;
  isRTL: boolean;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportInFlightRef = useRef(false);
  const [importing, setImporting] = useState(false);
  const [importModeDialogOpen, setImportModeDialogOpen] = useState(false);
  const [pendingImportPkg, setPendingImportPkg] = useState<PerleapCoursePackageAny | null>(null);

  const restrictToTeacherId =
    user?.user_metadata?.role === USER_ROLES.TEACHER ? user.id : undefined;

  const invalidateAfterCourseMutation = async () => {
    await queryClient.invalidateQueries({ queryKey: classroomKeys.detail(classroomId) });
    await queryClient.invalidateQueries({ queryKey: classroomKeys.lists() });
    await queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    await queryClient.invalidateQueries({ queryKey: syllabusKeys.outlineByClassroom(classroomId) });
    await queryClient.invalidateQueries({
      queryKey: assignmentKeys.classroomAssignmentLists(classroomId),
      exact: false,
    });
    await queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all, exact: false });
    /** Merge updates `activity_list` rows; syllabus hooks use staleTime 5m for section resources unless invalidated. */
    await queryClient.invalidateQueries({ queryKey: resourceKeys.all, exact: false });
  };

  const handleExportMergeSafe = async () => {
    if (exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    try {
      const { data, error } = await buildExportPackageForClassroom(classroomId, {
        restrictToTeacherId,
        variant: 'v2_merge',
      });
      if (error) {
        toast.error(t('coursePackage.exportFailed'), { description: error.message });
        return;
      }
      if (!data) {
        toast.error(t('coursePackage.exportFailed'));
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${safeFileSlug(classroomName)}-merge-${stamp}.perleap-course.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('coursePackage.exportSuccess'));
    } catch (e) {
      console.error(e);
      toast.error(t('coursePackage.exportFailed'));
    } finally {
      exportInFlightRef.current = false;
    }
  };

  const openFilePickerForImport = () => {
    queueMicrotask(() => fileInputRef.current?.click());
  };

  const closeImportModeDialog = () => {
    setImportModeDialogOpen(false);
    setPendingImportPkg(null);
  };

  const runMergeIntoCurrentClassroom = async (pkg: PerleapCoursePackageV2) => {
    const { data: mergeData, error: mergeErr } = await mergeCoursePackageIntoClassroom({
      classroomId,
      pkg,
      updateClassroomFromPackage: true,
      restrictToTeacherId,
    });
    if (mergeErr || !mergeData) {
      const ctx = getMergeFailureFromApiError(mergeErr ?? undefined);
      const phaseKey =
        ctx && ctx.phase ? `coursePackage.mergeError.phase.${ctx.phase}` : 'coursePackage.importFailed';
      const title =
        ctx && ctx.phase && i18n.exists(phaseKey) ? String(t(phaseKey)) : String(t('coursePackage.importFailed'));
      const parts: string[] = [];
      if (mergeErr?.message) parts.push(mergeErr.message);
      if (ctx?.humanLabel) {
        const step =
          ctx.indexInPkg != null ? ` (${t('coursePackage.mergeError.step')} ${ctx.indexInPkg + 1})` : '';
        parts.push(`${t('coursePackage.mergeError.location')}: «${ctx.humanLabel}»${step}`);
      }
      if (ctx?.entityId) parts.push(`${t('coursePackage.mergeError.entityIdLabel')}: ${ctx.entityId}`);
      parts.push(
        ctx?.atomic === true
          ? t('coursePackage.mergeRollbackHint')
          : t('coursePackage.mergePartialApplyWarning'),
      );
      toast.error(title, { description: parts.join('\n'), duration: 14000 });
      return;
    }
    toast.success(t('coursePackage.importMergeSuccess'));
    await invalidateAfterCourseMutation();
  };

  const runCreateNewClassroomFromPkg = async (pkg: PerleapCoursePackageAny) => {
    if (!user?.id) {
      toast.error(t('coursePackage.importFailed'), {
        description: t('coursePackage.importRequiresSignIn'),
      });
      return;
    }
    let pkgV1: PerleapCoursePackageV1;
    try {
      pkgV1 = packageForNewClassroomFromAny(pkg);
    } catch (normalizeErr) {
      toast.error(t('coursePackage.importFailed'), {
        description:
          normalizeErr instanceof Error ? normalizeErr.message : String(normalizeErr),
      });
      return;
    }
    const { data, error } = await importCoursePackageV1(pkgV1, user.id);
    if (error || !data?.classroomId?.trim()) {
      toast.error(t('coursePackage.importFailed'), { description: error?.message });
      return;
    }
    const newClassroomId = data.classroomId.trim();
    toast.success(t('coursePackage.importNewClassSuccess'));
    await queryClient.invalidateQueries({ queryKey: classroomKeys.lists() });
    await queryClient.invalidateQueries({ queryKey: classroomKeys.detail(newClassroomId) });
    /** Defer so AlertDialog teardown does not swallow the SPA navigation; replace avoids stacking the old classroom in history. */
    queueMicrotask(() => {
      navigate(buildRoute.teacherClassroom(newClassroomId), { replace: true });
    });
  };

  const handleIncomingPackageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.id) return;

    setImporting(true);
    try {
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        toast.error(t('coursePackage.importFailed'), { description: t('coursePackage.invalidFile') });
        return;
      }
      const parsed = parseCoursePackageJson(json);
      if (parsed.ok === false) {
        toast.error(t('coursePackage.importFailed'), { description: parsed.error });
        return;
      }

      setPendingImportPkg(parsed.data);
      setImportModeDialogOpen(true);
    } catch (err) {
      console.error(err);
      toast.error(t('coursePackage.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleImportModeCreateNew = async () => {
    const pkg = pendingImportPkg;
    if (!pkg || !user?.id) {
      closeImportModeDialog();
      return;
    }
    closeImportModeDialog();
    setImporting(true);
    try {
      await runCreateNewClassroomFromPkg(pkg);
    } finally {
      setImporting(false);
      setPendingImportPkg(null);
    }
  };

  const handleImportModeMergeHere = async () => {
    const pkg = pendingImportPkg;
    if (!pkg) {
      closeImportModeDialog();
      return;
    }
    if (pkg.version !== COURSE_PACKAGE_VERSION_V2) {
      toast.error(t('coursePackage.importFailed'), {
        description: t('coursePackage.importMergeNeedsV2'),
      });
      closeImportModeDialog();
      return;
    }
    closeImportModeDialog();
    setImporting(true);
    try {
      await runMergeIntoCurrentClassroom(pkg);
    } finally {
      setImporting(false);
      setPendingImportPkg(null);
    }
  };

  return (
    <>
      <Card
        className="w-full rounded-xl border-none shadow-sm bg-card ring-1 ring-border overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <CardHeader className="pb-2">
          <CardTitle className={cn('text-foreground text-lg', isRTL ? 'text-right' : 'text-left')}>
            {t('coursePackage.title')}
          </CardTitle>
          <CardDescription className={cn(isRTL ? 'text-right' : 'text-left')}>
            {t('coursePackage.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-hidden
            onChange={handleIncomingPackageFileSelected}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full gap-2"
            disabled={importing}
            onClick={() => void handleExportMergeSafe()}
          >
            <Download className="h-4 w-4" />
            {t('coursePackage.export')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full gap-2"
            disabled={importing || importModeDialogOpen}
            onClick={openFilePickerForImport}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {importing ? t('coursePackage.importing') : t('coursePackage.import')}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog
        open={importModeDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeImportModeDialog();
          else setImportModeDialogOpen(true);
        }}
      >
        <AlertDialogContent className="rounded-xl max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader className={cn(isRTL ? 'sm:text-right' : '')}>
            <AlertDialogTitle>{t('coursePackage.importModeTitle')}</AlertDialogTitle>
            <AlertDialogDescription
              className={cn(
                'text-muted-foreground text-sm text-balance md:text-pretty space-y-2',
                isRTL ? 'text-right' : 'text-left',
              )}
            >
              <span className="block">{t('coursePackage.importModeDescription')}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            className={cn(
              'flex flex-col gap-3 py-1 sm:items-stretch',
              isRTL ? 'sm:flex-row-reverse sm:justify-between' : 'sm:flex-row sm:justify-between',
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className={cn('text-sm font-medium', isRTL ? 'text-right' : 'text-left')}>
                {t('coursePackage.importModeCreateLabel')}
              </p>
              <p
                className={cn(
                  'flex-1 text-muted-foreground text-xs leading-snug',
                  isRTL ? 'text-right' : 'text-left',
                )}
              >
                {t('coursePackage.importModeCreateHint')}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full rounded-full bg-background text-foreground sm:w-auto"
                onClick={() => void handleImportModeCreateNew()}
              >
                {t('coursePackage.importModeCreateConfirm')}
              </Button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border/60 bg-muted/10 p-3">
              <p className={cn('text-sm font-medium', isRTL ? 'text-right' : 'text-left')}>
                {t('coursePackage.importModeMergeLabel')}
              </p>
              <p
                className={cn(
                  'flex-1 text-muted-foreground text-xs leading-snug',
                  isRTL ? 'text-right' : 'text-left',
                )}
              >
                {t('coursePackage.importModeMergeHint')}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full rounded-full bg-background text-foreground sm:w-auto"
                onClick={() => void handleImportModeMergeHere()}
              >
                {t('coursePackage.importModeMergeConfirm')}
              </Button>
            </div>
          </div>
          <AlertDialogFooter className={cn(isRTL ? 'sm:flex-row-reverse' : '')}>
            <AlertDialogCancel>{t('syllabus.cancel')}</AlertDialogCancel>

          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
