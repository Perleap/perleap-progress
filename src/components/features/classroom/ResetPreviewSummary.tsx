import type { ClassroomResetScopeCounts } from '@/types/api.types';

export type ResetPreviewSummaryProps = {
  resetPreview: ClassroomResetScopeCounts | undefined;
  resetPreviewLoading: boolean;
  resetPreviewError: boolean;
  studentCount: number;
  assignmentCount: number;
  isRTL: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
};

export function ResetPreviewSummary({
  resetPreview,
  resetPreviewLoading,
  resetPreviewError,
  studentCount,
  assignmentCount,
  isRTL,
  t,
}: ResetPreviewSummaryProps) {
  if (resetPreviewLoading) {
    return <p>{t('classroomDetail.resetDialog.previewLoading')}</p>;
  }

  if (resetPreviewError) {
    return <p className="text-destructive">{t('classroomDetail.resetDialog.previewError')}</p>;
  }

  return (
    <>
      <div>
        <p className="font-medium text-foreground mb-1">
          {t('classroomDetail.resetDialog.willRemoveTitle')}
        </p>
        <ul
          className={`list-disc space-y-1 ${isRTL ? 'list-inside pr-4' : 'list-inside pl-4'}`}
        >
          <li>
            {t('classroomDetail.resetDialog.willRemoveStudents', {
              count: resetPreview?.active_enrollments ?? studentCount,
            })}
          </li>
          <li>
            {t('classroomDetail.resetDialog.willRemoveSubmissions', {
              count: resetPreview?.submissions ?? 0,
            })}
          </li>
          <li>{t('classroomDetail.resetDialog.willRemoveProgress')}</li>
        </ul>
      </div>
      <div>
        <p className="font-medium text-foreground mb-1">
          {t('classroomDetail.resetDialog.willKeepTitle')}
        </p>
        <ul
          className={`list-disc space-y-1 ${isRTL ? 'list-inside pr-4' : 'list-inside pl-4'}`}
        >
          <li>{t('classroomDetail.resetDialog.willKeepCourse')}</li>
          <li>
            {t('classroomDetail.resetDialog.willKeepAssignments', {
              count: resetPreview?.assignments_preserved ?? assignmentCount,
            })}
          </li>
          <li>{t('classroomDetail.resetDialog.willKeepOutline')}</li>
        </ul>
      </div>
    </>
  );
}
