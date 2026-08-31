/**
 * Fix react-hooks/exhaustive-deps for `data?.x || []` patterns via useMemo.
 * Run: node scripts/fix-exhaustive-deps-usememo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const patches = [
  {
    file: 'src/components/StudentCalendar.tsx',
    replacements: [
      [
        '  const assignments = data?.assignments || [];\n  const classrooms = data?.classrooms || [];',
        '  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments]);\n  const classrooms = useMemo(() => data?.classrooms ?? [], [data?.classrooms]);',
      ],
    ],
  },
  {
    file: 'src/components/TeacherCalendar.tsx',
    replacements: [
      [
        '  const classrooms = data?.classrooms || [];\n  const assignments = data?.assignments || [];',
        '  const classrooms = useMemo(() => data?.classrooms ?? [], [data?.classrooms]);\n  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments]);',
      ],
    ],
  },
  {
    file: 'src/components/features/analytics/ClassroomAnalytics.tsx',
    replacements: [
      [
        '  const students = data?.students || [];\n  const allStudents = data?.allStudents || [];\n  const assignments = data?.assignments || [];',
        '  const students = useMemo(() => data?.students ?? [], [data?.students]);\n  const allStudents = useMemo(() => data?.allStudents ?? [], [data?.allStudents]);\n  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments]);',
      ],
      ['  const modules = data?.modules || [];', '  const modules = useMemo(() => data?.modules ?? [], [data?.modules]);'],
    ],
  },
  {
    file: 'src/components/features/analytics/LessonBriefContent.tsx',
    replacements: [
      [
        '  const assignments = data?.assignments || [];',
        '  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments]);',
      ],
      ['  const modules = data?.modules || [];', '  const modules = useMemo(() => data?.modules ?? [], [data?.modules]);'],
    ],
  },
  {
    file: 'src/components/features/analytics/PilotReportContent.tsx',
    replacements: [
      [
        '  const assignments = data?.assignments || [];',
        '  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments]);',
      ],
      ['  const modules = data?.modules || [];', '  const modules = useMemo(() => data?.modules ?? [], [data?.modules]);'],
    ],
  },
  {
    file: 'src/components/features/admin/AdminAiPromptsContent.tsx',
    replacements: [
      [
        '  const assignments = classroomAnalytics?.assignments || [];',
        '  const assignments = useMemo(() => classroomAnalytics?.assignments ?? [], [classroomAnalytics?.assignments]);',
      ],
    ],
  },
  {
    file: 'src/components/features/analytics/NuanceInsightsTable.tsx',
    replacements: [
      [
        '  const metrics = data?.metrics || [];\n  const recommendations = data?.recommendations || [];',
        '  const metrics = useMemo(() => data?.metrics ?? [], [data?.metrics]);\n  const recommendations = useMemo(() => data?.recommendations ?? [], [data?.recommendations]);',
      ],
    ],
  },
  {
    file: 'src/components/features/syllabus/SectionCommentThread.tsx',
    replacements: [
      [
        '  const comments = threadQuery.data || [];',
        '  const comments = useMemo(() => threadQuery.data ?? [], [threadQuery.data]);',
      ],
    ],
  },
  {
    file: 'src/components/features/syllabus/SectionContentPage.tsx',
    replacements: [
      [
        '  const resources = sectionResourcesQuery.data || [];',
        '  const resources = useMemo(() => sectionResourcesQuery.data ?? [], [sectionResourcesQuery.data]);',
      ],
    ],
  },
  {
    file: 'src/hooks/queries/useModuleFlowQueries.ts',
    replacements: [
      [
        '  const assignmentDoneMap = data?.assignmentDoneMap || new Map<string, boolean>();\n  const assignmentHasSubmissionRowMap =\n    data?.assignmentHasSubmissionRowMap || new Map<string, boolean>();',
        '  const assignmentDoneMap = useMemo(\n    () => data?.assignmentDoneMap ?? new Map<string, boolean>(),\n    [data?.assignmentDoneMap]\n  );\n  const assignmentHasSubmissionRowMap = useMemo(\n    () => data?.assignmentHasSubmissionRowMap ?? new Map<string, boolean>(),\n    [data?.assignmentHasSubmissionRowMap]\n  );',
      ],
    ],
  },
  {
    file: 'src/hooks/useStudentSectionModuleFlow.ts',
    replacements: [
      [
        '  const assignmentDoneMap = flowData?.assignmentDoneMap || new Map<string, boolean>();\n  const assignmentHasSubmissionRowMap =\n    flowData?.assignmentHasSubmissionRowMap || new Map<string, boolean>();',
        '  const assignmentDoneMap = useMemo(\n    () => flowData?.assignmentDoneMap ?? new Map<string, boolean>(),\n    [flowData?.assignmentDoneMap]\n  );\n  const assignmentHasSubmissionRowMap = useMemo(\n    () => flowData?.assignmentHasSubmissionRowMap ?? new Map<string, boolean>(),\n    [flowData?.assignmentHasSubmissionRowMap]\n  );',
      ],
    ],
  },
];

for (const { file, replacements } of patches) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.warn(`Missing ${file}`);
    continue;
  }
  let content = fs.readFileSync(full, 'utf8');
  if (!content.includes('useMemo') && content.includes('from \'react\'')) {
    content = content.replace(
      /from 'react'/,
      (m) => (content.includes('useMemo') ? m : m.replace("'react'", "'react'"))
    );
    if (!content.match(/import \{[^}]*useMemo/)) {
      content = content.replace(
        /import \{([^}]+)\} from 'react';/,
        (match, imports) => {
          if (imports.includes('useMemo')) return match;
          return `import {${imports.trim()}, useMemo } from 'react';`;
        }
      );
    }
  }
  for (const [from, to] of replacements) {
    if (!content.includes(from)) {
      console.warn(`SKIP ${file}: pattern not found`);
      continue;
    }
    content = content.split(from).join(to);
  }
  fs.writeFileSync(full, content);
  console.log(`Patched ${file}`);
}

console.log('useMemo exhaustive-deps patches applied.');
