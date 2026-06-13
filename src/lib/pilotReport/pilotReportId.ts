/** Slug for report IDs and filenames. */
export function slugifyCourseName(name: string | undefined | null): string {
  const slug =
    (name || 'course')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'course';
  return slug;
}

/** Human-readable pilot report ID: PR-{course-slug}-{YYYYMMDD}-{4char}. */
export function buildPilotReportId(courseName: string | undefined | null): string {
  const slug = slugifyCourseName(courseName);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PR-${slug}-${date}-${suffix}`;
}
