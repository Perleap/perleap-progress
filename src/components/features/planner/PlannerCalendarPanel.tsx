import { useMemo } from 'react';
import { Calendar, Views, type View } from 'react-big-calendar';
import { useTranslation } from 'react-i18next';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './planner-calendar.css';
import { PlannerCalendarEventChip, plannerLocalizer } from './plannerCalendarSetup';
import { pickContrastForegroundHex, type PlannerCalendarEvent } from './plannerTypes';
import { Card, CardContent } from '@/components/ui/card';

export type PlannerCalendarPanelProps = {
  culture: string;
  isRTL: boolean;
  events: PlannerCalendarEvent[];
  loading: boolean;
  view: View;
  date: Date;
  classroomColors: Record<string, string>;
  calendarMessages: Record<string, string>;
  onViewChange: (view: View) => void;
  onDateChange: (date: Date) => void;
  onSelectSlot: (slot: { start: Date }) => void;
  onSelectEvent: (event: PlannerCalendarEvent) => void;
};

export const PlannerCalendarPanel = ({
  culture,
  isRTL,
  events,
  loading,
  view,
  date,
  classroomColors,
  calendarMessages,
  onViewChange,
  onDateChange,
  onSelectSlot,
  onSelectEvent,
}: PlannerCalendarPanelProps) => {
  const { t } = useTranslation();
  const calendarComponents = useMemo(() => ({ event: PlannerCalendarEventChip }), []);

  const eventStyleGetter = (event: PlannerCalendarEvent) => {
    const backgroundColor = classroomColors[event.resource.classroomId] || '#3b82f6';
    const color = pickContrastForegroundHex(backgroundColor);
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.92,
        color,
        border: '0px',
        display: 'block',
      },
    };
  };

  return (
    <Card className="h-full flex flex-col min-h-0 shadow-sm border-border/50">
      <CardContent className="p-0 flex-1 h-full min-h-0">
        <div className="planner-rbc h-full min-h-[500px] p-4">
          <Calendar
            localizer={plannerLocalizer}
            culture={culture}
            rtl={isRTL}
            messages={calendarMessages}
            components={calendarComponents}
            events={events}
            startAccessor="start"
            endAccessor="end"
            allDayAccessor="allDay"
            style={{ height: '100%', minHeight: '500px' }}
            view={view}
            onView={onViewChange}
            date={date}
            onNavigate={onDateChange}
            selectable
            popup
            onSelectSlot={onSelectSlot}
            onSelectEvent={onSelectEvent}
            eventPropGetter={eventStyleGetter}
            tooltipAccessor={null}
            className="rounded-md"
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
          />
          {loading && (
            <span className="sr-only" aria-live="polite">
              {t('common.loading')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
