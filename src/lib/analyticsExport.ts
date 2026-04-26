import type { FiveDScores } from '@/types/models';

const DIMS: (keyof FiveDScores)[] = ['vision', 'values', 'thinking', 'connection', 'action'];

export function escapeCsvField(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsvField).join(',');
}

/**
 * Time-series or submission timeline charts for classroom analytics are intentionally not
 * included; date fields are not treated as a reliable product signal in this build.
 * See Phase 2 plan: trends deferred until data quality is verified.
 */
export const ANALYTICS_TRENDS_NOT_IMPLEMENTED = true;

export function buildClassroomAnalyticsCsv(input: {
  classroomId: string;
  exportedAtIso: string;
  structureTypeLabel: string;
  filterSummary: string;
  assignmentCountInScope: number;
  enrolledStudents: number;
  coveredStudents: number;
  classAverage5D: FiveDScores | null;
  kpi: {
    totalSubmissions: number;
    activeStudents: number;
    completionPercent: number;
    avgSubmissions: string;
  };
  perStudentRows?: { name: string; scores: FiveDScores }[];
}): string {
  const lines: string[] = [];
  lines.push(csvRow(['Key', 'Value']));
  lines.push(csvRow(['classroom_id', input.classroomId]));
  lines.push(csvRow(['exported_at', input.exportedAtIso]));
  lines.push(csvRow(['structure', input.structureTypeLabel]));
  lines.push(csvRow(['filters', input.filterSummary]));
  lines.push(csvRow(['assignments_in_scope', input.assignmentCountInScope]));
  lines.push(csvRow(['enrolled_students', input.enrolledStudents]));
  lines.push(csvRow(['students_with_feedback_in_scope', input.coveredStudents]));
  lines.push(csvRow(['coverage', `${input.coveredStudents}/${input.enrolledStudents}`]));
  lines.push('');
  lines.push(csvRow(['KPI', 'Value']));
  lines.push(csvRow(['total_submissions', input.kpi.totalSubmissions]));
  lines.push(csvRow(['active_students', input.kpi.activeStudents]));
  lines.push(csvRow(['completion_percent', input.kpi.completionPercent]));
  lines.push(csvRow(['avg_submissions_per_student', input.kpi.avgSubmissions]));
  lines.push('');

  if (input.classAverage5D) {
    lines.push(csvRow(['5D_aggregate', '']));
    lines.push(csvRow(['dimension', 'score']));
    for (const k of DIMS) {
      lines.push(csvRow([k, input.classAverage5D[k].toFixed(2)]));
    }
  }

  if (input.perStudentRows && input.perStudentRows.length > 0) {
    lines.push('');
    const header = ['student', ...DIMS];
    lines.push(header.map(escapeCsvField).join(','));
    for (const row of input.perStudentRows) {
      lines.push(
        csvRow([row.name, ...DIMS.map((d) => row.scores[d].toFixed(2))]),
      );
    }
  }

  return lines.join('\n');
}
