import { useTranslation } from 'react-i18next';
import type { PlannerClassroom } from '@/services/plannerService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type PlannerClassroomFilterSectionProps = {
  classrooms: PlannerClassroom[];
  filteredClassrooms: PlannerClassroom[];
  selectedClassrooms: Set<string>;
  classroomSearch: string;
  classroomColors: Record<string, string>;
  onSearchChange: (value: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onToggleClassroom: (classroomId: string, checked: boolean) => void;
};

export const PlannerClassroomFilterSection = ({
  filteredClassrooms,
  selectedClassrooms,
  classroomSearch,
  classroomColors,
  onSearchChange,
  onSelectAll,
  onClearAll,
  onToggleClassroom,
}: PlannerClassroomFilterSectionProps) => {
  const { t } = useTranslation();

  return (
    <Card className="h-full overflow-auto">
      <CardHeader className="space-y-3 pb-2">
        <CardTitle className="text-lg">{t('planner.classroomsTitle')}</CardTitle>
        <Input
          type="search"
          placeholder={t('planner.searchPlaceholder')}
          value={classroomSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onSelectAll}
          >
            {t('planner.selectAll')}
          </Button>
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onClearAll}>
            {t('planner.clearAll')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {filteredClassrooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('planner.noClassroomsMatch')}</p>
          ) : (
            filteredClassrooms.map((classroom) => (
              <div key={classroom.id} className="flex items-center gap-2">
                <Checkbox
                  id={`class-${classroom.id}`}
                  className="size-5 shrink-0"
                  checked={selectedClassrooms.has(classroom.id)}
                  onCheckedChange={(checked) => onToggleClassroom(classroom.id, checked === true)}
                />
                <Label
                  htmlFor={`class-${classroom.id}`}
                  className="flex items-center gap-2 cursor-pointer text-sm font-medium min-w-0 flex-1"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: classroomColors[classroom.id] || '#ccc' }}
                  />
                  <span className="truncate">{classroom.name}</span>
                </Label>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
