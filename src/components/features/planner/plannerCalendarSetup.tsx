import { memo } from 'react';
import { format } from 'date-fns/format';
import { getDay } from 'date-fns/getDay';
import { enUS } from 'date-fns/locale/en-US';
import { he } from 'date-fns/locale/he';
import { parse } from 'date-fns/parse';
import { startOfWeek } from 'date-fns/startOfWeek';
import { dateFnsLocalizer, type EventProps } from 'react-big-calendar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PlannerCalendarEvent } from './plannerTypes';

export const plannerLocales = {
  'en-US': enUS,
  he,
};

export const plannerLocalizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: plannerLocales,
});

export const PlannerCalendarEventChip = memo(({ event, title }: EventProps<PlannerCalendarEvent>) => {
  const display = typeof title === 'string' ? title : String(event.title ?? '');
  return (
    <Tooltip>
      <TooltipTrigger>
        <span className="block w-full max-w-full truncate text-left">{display}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <p className="break-words">{display}</p>
      </TooltipContent>
    </Tooltip>
  );
});
