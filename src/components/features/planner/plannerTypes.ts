export type PlannerCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: {
    assignmentId: string;
    classroomId: string;
    status: string;
    description: string;
    type: string;
    dueAtIso: string;
  };
};

export function pickContrastForegroundHex(bgHex: string): string {
  const hex = bgHex.replace('#', '');
  const expand =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.length === 6
        ? hex
        : null;
  if (!expand) return '#ffffff';
  const r = parseInt(expand.slice(0, 2), 16) / 255;
  const g = parseInt(expand.slice(2, 4), 16) / 255;
  const b = parseInt(expand.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? '#0a0a0a' : '#ffffff';
}
