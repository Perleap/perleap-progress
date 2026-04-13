'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Build `YYYY-MM-DDTHH:mm` for datetime-local / DB local semantics */
export function toDatetimeLocalString(d: Date, h: number, m: number) {
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${pad2(mo)}-${pad2(day)}T${pad2(h)}:${pad2(m)}`;
}

function parseDatetimeLocal(value: string): { date: Date; h: number; m: number } | null {
  if (!value?.trim()) return null;
  const d = parseISO(value);
  if (!isValid(d)) return null;
  return {
    date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    h: d.getHours(),
    m: d.getMinutes(),
  };
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

export interface DateTimePickerProps {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  dir?: 'ltr' | 'rtl';
}

export function DateTimePicker({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  dir,
}: DateTimePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseDatetimeLocal(value), [value]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');

  useEffect(() => {
    const p = parseDatetimeLocal(value);
    if (p) {
      setSelectedDate(p.date);
      setHour(pad2(p.h));
      setMinute(pad2(p.m));
    } else {
      setSelectedDate(undefined);
      setHour('09');
      setMinute('00');
    }
  }, [value]);

  const displayLabel = useMemo(() => {
    if (!parsed) return null;
    const d = parseISO(value);
    return isValid(d) ? format(d, 'PPp') : null;
  }, [parsed, value]);

  const apply = useCallback(() => {
    if (!selectedDate) return;
    const h = parseInt(hour, 10);
    const mi = parseInt(minute, 10);
    if (Number.isNaN(h) || Number.isNaN(mi)) return;
    onChange(toDatetimeLocalString(selectedDate, h, mi));
    setOpen(false);
  }, [selectedDate, hour, minute, onChange]);

  const setToday = useCallback(() => {
    const n = new Date();
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    setSelectedDate(d);
    setHour(pad2(n.getHours()));
    setMinute(pad2(n.getMinutes()));
    onChange(toDatetimeLocalString(d, n.getHours(), n.getMinutes()));
    setOpen(false);
  }, [onChange]);

  const clear = useCallback(() => {
    onChange('');
    setOpen(false);
  }, [onChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-start gap-2 rounded-xl border border-input bg-background px-3 h-11 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground w-full disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring/50',
          !displayLabel && 'text-muted-foreground',
          className
        )}
        dir={dir}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground pointer-events-none" />
        <span className="truncate text-start flex-1 min-w-0">
          {displayLabel ?? placeholder ?? t('datetimePicker.placeholder')}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 rounded-xl border shadow-lg max-w-[calc(100vw-2rem)]"
        align="start"
        sideOffset={8}
        dir={dir}
      >
        <div className="p-3 space-y-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              if (d) setSelectedDate(d);
            }}
            defaultMonth={selectedDate}
          />
          <div className="space-y-2 border-t border-border pt-3 px-1">
            <Label className="text-xs font-medium text-muted-foreground">{t('datetimePicker.time')}</Label>
            <div className="flex gap-2 items-center">
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger className="h-9 rounded-lg flex-1 min-w-0" dir={dir}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48 rounded-lg" dir={dir}>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground shrink-0">:</span>
              <Select value={minute} onValueChange={setMinute}>
                <SelectTrigger className="h-9 rounded-lg flex-1 min-w-0" dir={dir}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48 rounded-lg" dir={dir}>
                  {MINUTES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 pb-2 px-2">
            <div className={cn('flex gap-1', dir === 'rtl' && 'flex-row-reverse')}>
              <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs" onClick={clear}>
                {t('datetimePicker.clear')}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs" onClick={setToday}>
                {t('datetimePicker.today')}
              </Button>
            </div>
            <Button type="button" size="sm" className="rounded-full" disabled={!selectedDate} onClick={apply}>
              {t('datetimePicker.apply')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
