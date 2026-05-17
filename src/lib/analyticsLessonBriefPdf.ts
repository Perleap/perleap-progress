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

/** Accent (print-friendly blue). */
const ACCENT_RGB = [41, 98, 180] as [number, number, number];
const KPI_BAND_FILL = [240, 244, 250] as [number, number, number];
const STRIP_FILL = [234, 238, 245] as [number, number, number];

type JsPdfAuto = jsPDF & { lastAutoTable?: { finalY: number } };

export type SubmissionLike = {
  student_id: string;
  assignment_id: string;
  status: string;
};

/** How many scoped assignments have at least one completed submission by this student. */
export function countStudentCompletedAssignmentsInScope(
  studentId: string,
  submissions: SubmissionLike[],
  assignmentIdsInScope: string[],
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
  narrativesSectionTitle: string;
  studentSummaryLabel: string;
  footerDisclaimer: string;
  dash: string;
};

export type LessonBriefRosterRow = {
  studentId: string;
  studentName: string;
  completedInScope: number;
  assignmentsInScope: number;
  scores: FiveDScores | null;
  /** Scoped AI summary plus fallbacks — always set before PDF generation. */
  narrative: string;
};

/** Rows before per-student narrative fetch (lesson brief export pipeline). */
export type LessonBriefRosterBaseRow = Omit<LessonBriefRosterRow, 'narrative'>;

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
  fontSize = 10,
  lineMm = 4.8,
): number {
  doc.setFontSize(fontSize);
  doc.setFont('NotoSans', 'normal');
  const lines = doc.splitTextToSize(text, innerWidth);
  doc.text(lines, margin, y);
  return Math.max(lines.length * lineMm, lineMm + 2);
}

function ensureRoom(
  doc: jsPDF,
  y: number,
  needMm: number,
  margin: number,
  bottomReserveMm: number,
): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needMm <= h - bottomReserveMm) return y;
  doc.addPage();
  doc.setFont('NotoSans', 'normal');
  return margin + 8;
}

function drawMutedRule(doc: jsPDF, margin: number, y: number, innerW: number): void {
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + innerW, y);
}

function drawFooterBlock(
  doc: jsPDF,
  disclaimer: string,
  margin: number,
  maxLineWidth: number,
  pageWidth: number,
  pageNumber: number,
): void {
  doc.setFontSize(8);
  doc.setFont('NotoSans', 'normal');
  doc.setTextColor(80);
  const lines = doc.splitTextToSize(disclaimer, maxLineWidth);
  const footY = doc.internal.pageSize.getHeight() - 10;
  doc.text(lines, margin, footY - (lines.length - 1) * 3.5);
  doc.setTextColor(0);
  doc.text(String(pageNumber), pageWidth - margin, footY, { align: 'right' });
}

function drawBorderedCard(
  doc: jsPDF,
  title: string,
  contentLines: string[],
  x: number,
  y: number,
  width: number,
  titleFontSize = 11,
  contentFontSize = 9.5,
): number {
  const padding = 6;
  const titleH = 6;
  const lineH = 4.5;
  const contentH = contentLines.length * lineH;
  const totalH = padding * 2 + titleH + 4 + contentH; // title + gap + content

  // Card Border
  doc.setDrawColor(210, 220, 235); // Light blue border
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, totalH, 2, 2, 'FD');

  // Title
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(titleFontSize);
  doc.setTextColor(...ACCENT_RGB);
  doc.text(title, x + padding, y + padding + 4);

  // Title Underline Accent
  doc.setDrawColor(...ACCENT_RGB);
  doc.setLineWidth(0.5);
  const titleW = doc.getTextWidth(title);
  doc.line(x + padding, y + padding + 6, x + padding + Math.min(titleW, 20), y + padding + 6);

  // Content
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(contentFontSize);
  doc.setTextColor(60);
  doc.text(contentLines, x + padding, y + padding + 6 + 6);

  return totalH;
}

/** Returns a downloadable PDF Blob. */
export async function buildLessonBriefPdfBlob(input: LessonBriefPdfInput): Promise<Blob> {
  const fontUrl = resolveFontUrl(input.fontBaseUrl);
  const vfsName = NOTO_SANS_FILENAME;
  const fontData = await loadNotoSansBase64(fontUrl);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true }) as JsPdfAuto;
  doc.addFileToVFS(vfsName, fontData);
  doc.addFont(vfsName, 'NotoSans', 'normal');
  doc.setFont('NotoSans', 'normal');

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const innerW = pageWidth - margin * 2;
  const bottomReserve = 24;
  const dashChar = input.strings.dash;

  // 1. Full-Width Header
  const headerHeight = 36;
  doc.setFillColor(...ACCENT_RGB);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('NotoSans', 'bold');
  const titleLines = doc.splitTextToSize(input.strings.title.toUpperCase(), innerW);
  doc.text(titleLines, margin, 16);
  
  doc.setFontSize(12);
  doc.setFont('NotoSans', 'normal');
  const cn = input.classroomName?.trim();
  const nameLine = cn && cn.length > 0 ? cn : dashChar;
  doc.text(nameLine, margin, 16 + titleLines.length * 8);

  let y = headerHeight + 12;
  doc.setTextColor(0);

  // 2. 2-Column Metadata & KPI Grid
  const colW = (innerW - 8) / 2;
  const leftX = margin;
  const rightX = margin + colW + 8;
  
  const metaItems = [
    { label: input.strings.structure, val: input.structureLabel },
    { label: input.strings.exportedAt, val: input.exportedAtFormatted },
    { label: input.strings.scope, val: input.filterSummary }
  ];

  const kpis = [
    { label: input.strings.kpiAssignmentsInScope, val: String(input.scopeAssignmentCount) },
    { label: input.strings.enrolledStudents, val: String(input.enrolledStudents) },
    { label: input.strings.totalSubmissions, val: String(input.kpi.totalSubmissions) },
    { label: input.strings.activeStudents, val: String(input.kpi.activeStudents) },
    { label: input.strings.completionRate, val: `${input.kpi.completionPercent}%` },
    { label: input.strings.avgSubmissionsPerStudent, val: String(input.kpi.avgSubmissions) }
  ];

  let leftY = y;
  let rightY = y;

  doc.setFontSize(9);
  
  // Left Column: Meta
  for (const item of metaItems) {
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(...ACCENT_RGB);
    doc.text(`${item.label}:`, leftX, leftY);
    const labelW = doc.getTextWidth(`${item.label}: `);
    
    doc.setFont('NotoSans', 'normal');
    doc.setTextColor(60);
    const valLines = doc.splitTextToSize(item.val, colW - labelW);
    doc.text(valLines, leftX + labelW, leftY);
    leftY += valLines.length * 4.5 + 2;
  }

  // Right Column: KPIs
  for (const item of kpis) {
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(...ACCENT_RGB);
    doc.text(`${item.label}:`, rightX, rightY);
    const labelW = doc.getTextWidth(`${item.label}: `);
    
    doc.setFont('NotoSans', 'normal');
    doc.setTextColor(60);
    const valLines = doc.splitTextToSize(item.val, colW - labelW);
    doc.text(valLines, rightX + labelW, rightY);
    rightY += valLines.length * 4.5 + 2;
  }

  y = Math.max(leftY, rightY) + 8;
  doc.setTextColor(0);

  if (input.classAverage5D) {
    const dimMap = dimensionLabelMap(input.strings);
    const parts = DIM_KEYS.map((k) => `${dimMap[k]}: ${input.classAverage5D![k].toFixed(2)}`);
    const inlineText = parts.join('   •   ');
    
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(inlineText, innerW - 12);
    
    // Estimate card height: padding*2 + titleH + gap + contentH
    const cardH = 12 + 6 + 4 + lines.length * 4.5;
    y = ensureRoom(doc, y, cardH + 8, margin, bottomReserve);
    
    const actualH = drawBorderedCard(
      doc, 
      input.strings.classAverage5DSectionTitle.toUpperCase(), 
      lines, 
      margin, 
      y, 
      innerW
    );
    y += actualH + 10;
  }

  y = ensureRoom(doc, y, 34, margin, bottomReserve);
  doc.setFontSize(12);
  doc.setFont('NotoSans', 'bold');
  doc.setTextColor(...ACCENT_RGB);
  y += wrapAndDrawParagraph(doc, input.strings.rosterSectionTitle.toUpperCase(), margin, innerW, y, 12, 6);
  doc.setTextColor(0);
  y += 2;

  const dimHeader = DIM_KEYS.map((k) => dimensionLabelMap(input.strings)[k]);
  const tableHead = [[input.strings.columnStudent, input.strings.columnProgress, ...dimHeader]];
  const body = input.rosterRows.map((row) => {
    const denom = Math.max(0, row.assignmentsInScope);
    const progressCell =
      denom === 0 ? `${dashChar}/${dashChar}` : `${row.completedInScope}/${denom}`;
    return [
      row.studentName,
      progressCell,
      ...DIM_KEYS.map((k) => scoreCell(row.scores, k, dashChar)),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body,
    styles: {
      font: 'NotoSans',
      fontSize: 8.6,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      textColor: [60, 60, 60],
      lineColor: [230, 235, 245],
      lineWidth: { bottom: 0.2 },
      valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      font: 'NotoSans',
      fontStyle: 'bold',
      fontSize: 9,
      textColor: ACCENT_RGB,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      lineWidth: { bottom: 0.5 },
      lineColor: ACCENT_RGB,
    },
    bodyStyles: { font: 'NotoSans' },
    alternateRowStyles: { fillColor: [252, 253, 255] },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 24, halign: 'center' },
    },
    margin: { top: margin, left: margin, right: margin, bottom: bottomReserve },
    showHead: 'everyPage',
    horizontalPageBreak: true,
  });

  let yCursor = doc.lastAutoTable?.finalY != null ? doc.lastAutoTable.finalY + 14 : y + 20;

  // Calculate space needed for title + first row to avoid orphaned title
  let firstBlockReserve = 14; // Title height approx
  if (input.rosterRows.length > 0) {
    const firstRow = input.rosterRows[0]!;
    doc.setFontSize(9.5);
    const narrLines = doc.splitTextToSize(
      `${input.strings.studentSummaryLabel}: ${firstRow.narrative}`,
      innerW - 12,
    );
    // Card height estimation
    firstBlockReserve += 12 + 6 + 4 + narrLines.length * 4.5 + 8;
  }

  yCursor = ensureRoom(doc, yCursor, firstBlockReserve, margin, bottomReserve);

  doc.setFontSize(12);
  doc.setFont('NotoSans', 'bold');
  doc.setTextColor(...ACCENT_RGB);
  yCursor += wrapAndDrawParagraph(
    doc,
    input.strings.narrativesSectionTitle.toUpperCase(),
    margin,
    innerW,
    yCursor,
    12,
    6,
  );
  yCursor += 4;

  for (const row of input.rosterRows) {
    const denom = Math.max(0, row.assignmentsInScope);
    const prog = denom === 0 ? dashChar : `${row.completedInScope}/${denom}`;
    const headerText = `${row.studentName} (${prog})`;
    
    doc.setFontSize(9.5);
    const narrLines = doc.splitTextToSize(
      `${input.strings.studentSummaryLabel}: ${row.narrative}`,
      innerW - 12,
    );
    
    const cardH = 12 + 6 + 4 + narrLines.length * 4.5;
    yCursor = ensureRoom(doc, yCursor, cardH + 8, margin, bottomReserve);

    const actualH = drawBorderedCard(
      doc,
      headerText,
      narrLines,
      margin,
      yCursor,
      innerW
    );
    
    yCursor += actualH + 6;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('NotoSans', 'normal');
    drawFooterBlock(doc, input.strings.footerDisclaimer, margin, innerW, pageWidth, page);
  }

  return doc.output('blob');
}