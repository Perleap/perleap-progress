import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TeacherEvaluationForm } from '@/components/features/submission/TeacherEvaluationForm';
import type { StudentEvaluationState } from '@/services/liveSessionService';

type LiveSessionEnrollment = {
  student_id: string;
  student_profiles?: { full_name?: string | null } | null;
};

export type LiveSessionEvaluationSectionProps = {
  assignmentId: string;
  isRTL: boolean;
  students: LiveSessionEnrollment[];
  studentNameById: Record<string, string>;
  evalStates: Record<string, StudentEvaluationState>;
  selectedStudentId: string | null;
  activeSubmissionId: string | null;
  preparingEval: boolean;
  sessionContext?: string;
  onSelectStudent: (studentId: string) => void | Promise<void>;
  onEvaluationComplete: () => void | Promise<void>;
};

export function LiveSessionEvaluationSection({
  assignmentId,
  isRTL,
  students,
  studentNameById,
  evalStates,
  selectedStudentId,
  activeSubmissionId,
  preparingEval,
  sessionContext,
  onSelectStudent,
  onEvaluationComplete,
}: LiveSessionEvaluationSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('liveSession.evaluation.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('liveSession.evaluation.hint')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={selectedStudentId ?? undefined}
            onValueChange={(studentId) => void onSelectStudent(studentId)}
          >
            <SelectTrigger
              className={cn(
                'h-auto w-full rounded-lg border p-3 shadow-none',
                'focus-visible:ring-2 focus-visible:ring-primary/25',
                isRTL && 'flex-row-reverse text-end',
              )}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <span
                className={cn(
                  'flex min-w-0 flex-1 items-center justify-between gap-2',
                  isRTL && 'flex-row-reverse',
                )}
              >
                <SelectValue placeholder={t('liveSession.evaluation.selectStudent')}>
                  {selectedStudentId ? studentNameById[selectedStudentId] : null}
                </SelectValue>
                {selectedStudentId && evalStates[selectedStudentId]?.evaluated ? (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-green-600"
                    aria-label={t('liveSession.evaluation.evaluated')}
                  />
                ) : selectedStudentId ? (
                  <span className="h-4 w-4 shrink-0" aria-hidden />
                ) : null}
              </span>
            </SelectTrigger>
            <SelectContent
              className="rounded-lg border-border bg-card p-1"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {students.map((enrollment) => {
                const studentId = enrollment.student_id;
                const name = studentNameById[studentId] ?? t('common.student');
                return (
                  <SelectItem
                    key={studentId}
                    value={studentId}
                    className="cursor-pointer rounded-lg"
                  >
                    {name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedStudentId ? (
          preparingEval ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('liveSession.evaluation.preparing')}
            </div>
          ) : activeSubmissionId ? (
            <TeacherEvaluationForm
              key={selectedStudentId}
              submissionId={activeSubmissionId}
              studentId={selectedStudentId}
              assignmentId={assignmentId}
              sessionContext={sessionContext}
              onEvaluationComplete={() => void onEvaluationComplete()}
            />
          ) : null
        ) : null}
      </CardContent>
    </Card>
  );
}
