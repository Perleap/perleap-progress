/**
 * Compute a human-readable course duration string from start and end dates.
 *
 * Rules:
 *  - < 7 days            → "X days"
 *  - exact weeks          → "X weeks"
 *  - < 1 month            → "X weeks, Y days"
 *  - exact months         → "X month(s)"
 *  - months + days        → "X month(s), Y days"
 *  - 12+ months           → "X year(s), Y month(s)"
 *
 * Returns `null` when either date is missing or end <= start.
 */
export function formatCourseDuration(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string | null {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  if (end <= start) return null;

  const totalDays = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (totalDays < 7) {
    return `${totalDays} day${totalDays !== 1 ? 's' : ''}`;
  }

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prev = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prev.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  if (totalMonths >= 12) {
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    const yStr = `${y} year${y !== 1 ? 's' : ''}`;
    if (m === 0 && days === 0) return yStr;
    if (m > 0) return `${yStr}, ${m} month${m !== 1 ? 's' : ''}`;
    return `${yStr}, ${days} day${days !== 1 ? 's' : ''}`;
  }

  if (totalMonths >= 1) {
    const mStr = `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
    if (days === 0) return mStr;
    return `${mStr}, ${days} day${days !== 1 ? 's' : ''}`;
  }

  const weeks = Math.floor(totalDays / 7);
  const remDays = totalDays % 7;
  const wStr = `${weeks} week${weeks !== 1 ? 's' : ''}`;
  if (remDays === 0) return wStr;
  return `${wStr}, ${remDays} day${remDays !== 1 ? 's' : ''}`;
}
