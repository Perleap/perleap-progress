import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ReleaseMode } from '@/types/syllabus';

const RELEASE_MODES: ReleaseMode[] = [
  'all_at_once',
  'sequential',
  'date_based',
  'manual',
  'prerequisites',
];

interface ReleaseModeSelectProps {
  value: ReleaseMode;
  onChange: (v: ReleaseMode) => void;
  id?: string;
  className?: string;
  triggerClassName?: string;
  label?: string;
  isRTL?: boolean;
}

export function ReleaseModeSelect({
  value,
  onChange,
  id,
  className,
  triggerClassName,
  label,
  isRTL,
}: ReleaseModeSelectProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <Label
          htmlFor={id}
          className={cn('text-sm font-medium', isRTL && 'block text-end')}
        >
          {label}
        </Label>
      ) : null}
      <Select value={value} onValueChange={(v) => onChange(v as ReleaseMode)}>
        <SelectTrigger id={id} className={cn('rounded-lg', triggerClassName)}>
          <SelectValue>
            {t(`syllabus.releaseMode.${value}`, value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {RELEASE_MODES.map((mode) => (
            <SelectItem key={mode} value={mode}>
              <div className="flex flex-col">
                <span className="font-medium">{t(`syllabus.releaseMode.${mode}`, mode)}</span>
                <span className="text-xs text-muted-foreground">
                  {t(`syllabus.releaseMode.${mode}Desc`, '')}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
