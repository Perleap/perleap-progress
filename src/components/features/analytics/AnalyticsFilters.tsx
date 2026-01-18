/**
 * Analytics Filters Component
 * Filter selectors for classroom analytics
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Assignment } from '@/types';
import { useTranslation } from 'react-i18next';

interface AnalyticsFiltersProps {
  students: Array<{ id: string; name: string }>;
  assignments: Assignment[];
  selectedStudent: string;
  selectedAssignment: string;
  onStudentChange: (value: string) => void;
  onAssignmentChange: (value: string) => void;
}

/**
 * Display filters for analytics (student and assignment selectors)
 */
export const AnalyticsFilters = ({
  students,
  assignments,
  selectedStudent,
  selectedAssignment,
  onStudentChange,
  onAssignmentChange,
}: AnalyticsFiltersProps) => {
  const { t } = useTranslation();

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base md:text-lg text-foreground">Analytics Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium mb-2 block text-muted-foreground">Filter by Student</label>
            <Select value={selectedStudent} onValueChange={onStudentChange}>
              <SelectTrigger className="bg-muted/30 border-border text-foreground min-w-[180px]">
                <SelectValue>
                  {selectedStudent === 'all' ? t('analytics.allStudents') : students.find(s => s.id === selectedStudent)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">{t('analytics.allStudents')}</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block text-muted-foreground">Filter by Assignment</label>
            <Select value={selectedAssignment} onValueChange={onAssignmentChange}>
              <SelectTrigger className="bg-muted/30 border-border text-foreground min-w-[180px]">
                <SelectValue>
                  {selectedAssignment === 'all' ? t('analytics.allAssignments') : assignments.find(a => a.id === selectedAssignment)?.title}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">{t('analytics.allAssignments')}</SelectItem>
                {assignments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
