import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Users, BookOpen } from 'lucide-react';

export interface AnalyticsFilterControlsProps {
  allStudents: { id: string; name: string }[];
  assignments: { id: string; title: string }[];
  selectedStudent: string;
  selectedAssignment: string;
  onStudentChange: (value: string) => void;
  onAssignmentChange: (value: string) => void;
}

/** Shared student + assignment selects for analytics and nuance cards (same layout and copy). */
export function AnalyticsFilterControls({
  allStudents,
  assignments,
  selectedStudent,
  selectedAssignment,
  onStudentChange,
  onAssignmentChange,
}: AnalyticsFilterControlsProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  return (
    <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-start sm:gap-x-6 sm:gap-y-3">
      <div className="w-full space-y-2 sm:w-auto sm:min-w-[200px] sm:max-w-[min(100%,360px)]">
        <label
          className={`text-sm font-semibold text-muted-foreground ms-1 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
        >
          <Users className="h-4 w-4" />
          {t('analytics.filterByStudent')}
        </label>
        <Select value={selectedStudent} onValueChange={onStudentChange}>
          <SelectTrigger
            className={`h-12 w-full rounded-lg border-border bg-muted/30 focus:bg-card focus:ring-2 focus:ring-ring/20 transition-all ${isRTL ? 'text-right' : 'text-left'} text-foreground sm:min-w-[220px]`}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <SelectValue>
              {selectedStudent === 'all'
                ? t('analytics.allStudents')
                : allStudents.find((s) => s.id === selectedStudent)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border bg-card p-1" dir={isRTL ? 'rtl' : 'ltr'}>
            <SelectItem value="all" className="rounded-xl cursor-pointer">
              {t('analytics.allStudents')}
            </SelectItem>
            {allStudents.map((s) => (
              <SelectItem key={s.id} value={s.id} className="rounded-xl cursor-pointer">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full space-y-2 sm:w-auto sm:min-w-[200px] sm:max-w-[min(100%,360px)]">
        <label
          className={`text-sm font-semibold text-muted-foreground ms-1 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
        >
          <BookOpen className="h-4 w-4" />
          {t('analytics.filterByAssignment')}
        </label>
        <Select value={selectedAssignment} onValueChange={onAssignmentChange}>
          <SelectTrigger
            className={`h-12 w-full rounded-lg border-border bg-muted/30 focus:bg-card focus:ring-2 focus:ring-ring/20 transition-all ${isRTL ? 'text-right' : 'text-left'} text-foreground sm:min-w-[220px]`}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <SelectValue>
              {selectedAssignment === 'all'
                ? t('analytics.allAssignments')
                : assignments.find((a) => a.id === selectedAssignment)?.title}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border bg-card p-1" dir={isRTL ? 'rtl' : 'ltr'}>
            <SelectItem value="all" className="rounded-xl cursor-pointer">
              {t('analytics.allAssignments')}
            </SelectItem>
            {assignments.map((a) => (
              <SelectItem key={a.id} value={a.id} className="rounded-xl cursor-pointer">
                {a.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
