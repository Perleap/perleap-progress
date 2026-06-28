/** `perleap-pilot-report-{course}-{date}.html` */
export function pilotReportDownloadFilename(courseName: string | undefined | null): string {
  const shortName =
    (courseName || 'course')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'course';
  const date = new Date().toISOString().slice(0, 10);
  return `perleap-pilot-report-${shortName}-${date}.html`;
}

/** Same slug as HTML export, with `.pdf` extension. */
export function pilotReportPdfFilename(courseName: string | undefined | null): string {
  return pilotReportDownloadFilename(courseName).replace(/\.html$/, '.pdf');
}
