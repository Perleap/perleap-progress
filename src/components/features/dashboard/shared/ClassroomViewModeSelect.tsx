import {
  CalendarDays,
  Grid2x2,
  LayoutGrid,
  LayoutList,
  List,
  Table2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type ClassroomViewMode, getClassroomViewModeLabel } from '@/lib/classroomViewMode';

const VIEW_MODE_OPTIONS: { value: ClassroomViewMode; icon: typeof LayoutGrid }[] = [
  { value: 'grid', icon: LayoutGrid },
  { value: 'compact', icon: Grid2x2 },
  { value: 'list', icon: List },
  { value: 'detailed', icon: LayoutList },
  { value: 'table', icon: Table2 },
  { value: 'timeline', icon: CalendarDays },
];

export type ClassroomViewModeSelectProps = {
  value: ClassroomViewMode;
  onValueChange: (value: ClassroomViewMode) => void;
  className?: string;
};

export function ClassroomViewModeSelect({
  value,
  onValueChange,
  className,
}: ClassroomViewModeSelectProps) {
  const { t } = useTranslation();

  return (
    <div className={`flex gap-2 items-center ${className ?? ''}`}>
      <span className="text-sm text-muted-foreground mr-2">{t('classroomList.viewLabel')}</span>
      <Select value={value} onValueChange={(v) => onValueChange(v as ClassroomViewMode)}>
        <SelectTrigger className="w-[180px] bg-card">
          <SelectValue>
            <span>{getClassroomViewModeLabel(value, t)}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-card">
          {VIEW_MODE_OPTIONS.map(({ value: mode, icon: Icon }) => (
            <SelectItem key={mode} value={mode}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{t(`classroomList.viewModes.${mode}`)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
