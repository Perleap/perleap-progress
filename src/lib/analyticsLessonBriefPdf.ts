/**
 * Classroom lesson-brief PDF for teacher analytics exports.
 *
 * KPI semantics align with CSV export (`buildClassroomAnalyticsCsv`): when analytics filters
 * narrow the view (`isNarrowingView`), submission counts reflect feedback rows in scope; when
 * not narrowing, KPIs mirror whole-class aggregates from `ClassroomAnalytics`.
 *
 * Fonts: Requires `/fonts/NotoSans-Regular.ttf` (Unicode, Latin + Hebrew) for student names and
 * translated strings; default Helvetica cannot render Hebrew.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FiveDScores } from '@/types/models';

/** Keep in sync with 5D keys and CSV export ordering. */
const DIM_KEYS: readonly (keyof FiveDScores)[] = [
  'vision',
  'values',
  'thinking',
  'connection',
  'action',
] as const;

const NOTO_SANS_FILENAME = 'NotoSans-Regular.ttf';

export type SubmissionLike = {
  student_id: string;
  assignment_id: string;
  status: string;
};

/** How many scoped assignments have at least one completed submission by this student. */
export function countStudentCompletedAssignmentsInScope(
  studentId: string,
  submissions: SubmissionLike[],
  assignmentIdsInScope: string[]
): number {
  if (assignmentIdsInScope.length === 0) return 0;
  const scopeSet = new Set(assignmentIdsInScope);
  const done = new Set<string>();
  for (const s of submissions) {
    if (s.student_id !== studentId) continue;
    if (!scopeSet.has(s.assignment_id)) continue;
    if (s.status !== 'completed') continue;
    done.add(s.assignment_id);
  }
  return done.size;
}

export function scoreCell(score: FiveDScores | null, key: keyof FiveDScores, dash: string): string {
  return score === null ? dash : score[key].toFixed(2);
}

export type LessonBriefPdfStrings = {
  title: string;
  classroom: string;
  structure: string;
  exportedAt: string;
  scope: string;
  kpiSnapshotTitle: string;
  kpiAssignmentsInScope: string;
  enrolledStudents: string;
  totalSubmissions: string;
  activeStudents: string;
  completionRate: string;
  avgSubmissionsPerStudent: string;
  classAverage5DSectionTitle: string;
  dimVision: string;
  dimValues: string;
  dimThinking: string;
  dimConnection: string;
  dimAction: string;
  rosterSectionTitle: string;
  columnStudent: string;
  columnProgress: string;
  footerDisclaimer: string;
  dash: string;
};

export type LessonBriefRosterRow = {
  studentName: string;
  completedInScope: number;
  assignmentsInScope: number;
  scores: FiveDScores | null;
};

export type LessonBriefPdfInput = {
  strings: LessonBriefPdfStrings;
  classroomName?: string | null;
  exportedAtFormatted: string;
  structureLabel: string;
  filterSummary: string;
  /** Same as CSV `effectiveAssignmentIds.length`. */
  scopeAssignmentCount: number;
  enrolledStudents: number;
  kpi: {
    totalSubmissions: number;
    activeStudents: number;
    completionPercent: number;
    avgSubmissions: string;
  };
  classAverage5D: FiveDScores | null;
  rosterRows: LessonBriefRosterRow[];
  /** Overrides font URL prefix (defaults to `import.meta.env.BASE_URL`). */
  fontBaseUrl?: string;
};

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function resolveFontUrl(baseOverride?: string): string {
  const base =
    baseOverride ?? (typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/') ?? '/';
  const str = typeof base === 'string' ? base : '/';
  const normalized = str.endsWith('/') ? str : `${str.replace(/\/?$/, '/')}`;
  return `${normalized}fonts/${NOTO_SANS_FILENAME}`;
}

async function loadNotoSansBase64(fontUrl: string): Promise<string> {
  const response = await fetch(fontUrl);
  if (!response.ok) {
    throw new Error(`Failed to load lesson-brief PDF font (${response.status}).`);
  }
  const buf = await response.arrayBuffer();
  return arrayBufferToBase64(buf);
}

function dimensionLabelMap(s: LessonBriefPdfStrings): Record<keyof FiveDScores, string> {
  return {
    vision: s.dimVision,
    values: s.dimValues,
    thinking: s.dimThinking,
    connection: s.dimConnection,
    action: s.dimAction,
  };
}

function wrapAndDrawParagraph(
  doc: jsPDF,
  text: string,
  margin: number,
  innerWidth: number,
  y: number,
  fontSize = 10
): number {
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, innerWidth);
  doc.text(lines, margin, y);
  return lines.length * 5;
}

function drawFooterBlock(
  doc: jsPDF,
  disclaimer: string,
  margin: number,
  maxLineWidth: number,
  pageWidth: number,
  pageNumber: number
): void {
  doc.setFontSize(8);
  doc.setTextColor(80);
  const lines = doc.splitTextToSize(disclaimer, maxLineWidth);
  const footY = doc.internal.pageSize.getHeight() - 10;
  doc.text(lines, margin, footY - (lines.length - 1) * 3.5);
  doc.setTextColor(0);
  doc.text(String(pageNumber), pageWidth - margin, footY, { align: 'right' });
}

/** Returns a downloadable PDF Blob. */
export async function buildLessonBriefPdfBlob(input: LessonBriefPdfInput): Promise<Blob> {
  const fontUrl = resolveFontUrl(input.fontBaseUrl);
  const vfsName = NOTO_SANS_FILENAME;
  const fontData = await loadNotoSansBase64(fontUrl);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS(vfsName, fontData);
  doc.addFont(vfsName, 'NotoSans', 'normal');
  doc.setFont('NotoSans');

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const innerW = pageWidth - margin * 2;
  let y = margin;

  doc.setFontSize(16);
  doc.text(input.strings.title, margin, y);
  y += 9;

  doc.setFontSize(10);

  const cn = input.classroomName?.trim();
  const nameLine =
    cn && cn.length > 0 ? `${input.strings.classroom}: ${cn}` : `${input.strings.classroom}: —`;
  doc.text(nameLine, margin, y);
  y += 6;

  doc.text(`${input.strings.structure}: ${input.structureLabel}`, margin, y);
  y += 6;

  doc.text(`${input.strings.exportedAt}: ${input.exportedAtFormatted}`, margin, y);
  y += 6;

  const scopeWrapped = doc.splitTextToSize(
    `${input.strings.scope}: ${input.filterSummary}`,
    innerW
  );
  doc.text(scopeWrapped, margin, y);
  y += scopeWrapped.length * 5 + 4;

  doc.setFontSize(11);
  doc.text(`${input.strings.kpiSnapshotTitle}`, margin, y);
  y += 7;

  doc.setFontSize(10);
  const kpis: [string, string][] = [
    [input.strings.kpiAssignmentsInScope, String(input.scopeAssignmentCount)],
    [input.strings.enrolledStudents, String(input.enrolledStudents)],
    [input.strings.totalSubmissions, String(input.kpi.totalSubmissions)],
    [input.strings.activeStudents, String(input.kpi.activeStudents)],
    [input.strings.completionRate, `${input.kpi.completionPercent}%`],
    [input.strings.avgSubmissionsPerStudent, String(input.kpi.avgSubmissions)],
  ];
  for (const [label, val] of kpis) {
    y += wrapAndDrawParagraph(doc, `${label}: ${val}`, margin, innerW, y, 10);
  }

  y += 6;

  if (input.classAverage5D) {
    doc.setFontSize(11);
    doc.text(`${input.strings.classAverage5DSectionTitle}`, margin, y);
    y += 7;

    doc.setFontSize(10);
    const dimMap = dimensionLabelMap(input.strings);
    for (const k of DIM_KEYS) {
      doc.text(`${dimMap[k]}: ${input.classAverage5D[k].toFixed(2)}`, margin + 4, y);
      y += 6;
    }
    y += 6;
  }

  doc.setFontSize(11);
  doc.text(input.strings.rosterSectionTitle, margin, y);
  y += 7;

  const dimHeader = DIM_KEYS.map((k) => dimensionLabelMap(input.strings)[k]);
  const tableHead = [[input.strings.columnStudent, input.strings.columnProgress, ...dimHeader]];
  const dash = input.strings.dash;
  const body = input.rosterRows.map((row) => {
    const denom = Math.max(0, row.assignmentsInScope);
    const progressCell = denom === 0 ? `${dash}/${dash}` : `${row.completedInScope}/${denom}`;
    return [row.studentName, progressCell, ...DIM_KEYS.map((k) => scoreCell(row.scores, k, dash))];
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body,
    styles: { font: 'NotoSans', fontSize: 8, cellPadding: 1.5, textColor: 0 },
    headStyles: { fillColor: [235, 235, 235], font: 'NotoSans', fontStyle: 'normal', textColor: 0 },
    bodyStyles: { font: 'NotoSans', textColor: 0 },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 22, halign: 'center' },
    },
    margin: { top: margin, left: margin, right: margin, bottom: 22 },
    showHead: 'everyPage',
    horizontalPageBreak: true,
  });

  const n = doc.getNumberOfPages();
  for (let page = 1; page <= n; page++) {
    doc.setPage(page);
    doc.setFont('NotoSans');
    drawFooterBlock(doc, input.strings.footerDisclaimer, margin, innerW, pageWidth, page);
  }

  return doc.output('blob');
}
