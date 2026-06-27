import { exportDomBlocksToPdf } from '@/lib/exportHtmlBlocksToPdf';

export function lessonBriefPdfFilename(courseName: string | undefined | null): string {
  const shortName =
    (courseName || 'course')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'course';
  const date = new Date().toISOString().slice(0, 10);
  return `lesson_brief_${shortName}_${date}.pdf`;
}

export async function exportLessonBriefPdf(params: {
  contentRootId: string;
  filename: string;
}): Promise<void> {
  await exportDomBlocksToPdf(`#${params.contentRootId}`, params.filename);
}
