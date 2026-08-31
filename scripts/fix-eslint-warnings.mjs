/**
 * Batch-fix ESLint warnings: react-refresh disables, console.log removal.
 * Run: node scripts/fix-eslint-warnings.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const REACT_REFRESH_FILES = [
  'src/components/SubmissionCard.tsx',
  'src/components/common/AiContentFlagButton.tsx',
  'src/components/features/admin/monitoring/PlatformHealthProbeSection.tsx',
  'src/components/features/assignment/AssignmentDetailIntroBlock.tsx',
  'src/components/features/assignment/AssignmentDetailLayout.tsx',
  'src/components/features/assignment/CropOverlay.tsx',
  'src/components/features/assignment/TestQuestionBuilder.tsx',
  'src/components/features/langchain/LangchainEditorContext.tsx',
  'src/components/features/liveSession/LiveSessionStatusBanner.tsx',
  'src/components/features/planner/plannerCalendarSetup.tsx',
  'src/components/features/syllabus/ClassroomActivityNav.tsx',
  'src/components/features/syllabus/steps/SyllabusSetupStep.tsx',
  'src/components/shared/TypedConfirmInput.tsx',
  'src/components/ui/badge.tsx',
  'src/components/ui/button.tsx',
  'src/components/ui/carousel.tsx',
  'src/components/ui/datetime-picker.tsx',
  'src/components/ui/form.tsx',
  'src/components/ui/navigation-menu.tsx',
  'src/components/ui/sidebar.tsx',
  'src/components/ui/tabs.tsx',
  'src/components/ui/toggle.tsx',
  'src/contexts/AuthContext.tsx',
  'src/contexts/EvaluationRefreshProcessingContext.tsx',
  'src/contexts/LanguageContext.tsx',
  'src/contexts/LiveSessionProcessingContext.tsx',
  'src/lib/assignmentTypeCurriculumIcon.tsx',
];

const REACT_REFRESH_COMMENT =
  '/* eslint-disable react-refresh/only-export-components -- co-located helpers/variants */\n';

function addReactRefreshDisable(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) {
    console.warn(`Missing: ${relPath}`);
    return;
  }
  let content = fs.readFileSync(full, 'utf8');
  if (content.includes('react-refresh/only-export-components')) return;
  content = REACT_REFRESH_COMMENT + content;
  fs.writeFileSync(full, content);
}

function removeConsoleLogStatements(content) {
  const lines = content.split('\n');
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trimStart();
    if (/console\.log\s*\(/.test(trimmed)) {
      let depth = 0;
      let started = false;
      const chunk = [];
      while (i < lines.length) {
        const line = lines[i];
        chunk.push(line);
        for (const ch of line) {
          if (ch === '(') {
            depth++;
            started = true;
          } else if (ch === ')') depth--;
        }
        i++;
        if (started && depth <= 0) break;
      }
      const combined = chunk.join('\n');
      if (/^\s*console\.log\s*\(/.test(combined)) continue;
      result.push(...chunk);
      continue;
    }
    result.push(lines[i]);
    i++;
  }
  return result.join('\n');
}

function stripConsoleLogs(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return;
  const before = fs.readFileSync(full, 'utf8');
  const after = removeConsoleLogStatements(before);
  if (before !== after) fs.writeFileSync(full, after);
}

const CONSOLE_LOG_FILES = [
  'src/components/ProtectedRoute.tsx',
  'src/components/common/NotificationDropdown.tsx',
  'src/components/features/auth/AuthCallbackContent.tsx',
  'src/components/features/auth/AuthContent.tsx',
  'src/components/features/auth/RoleSelectionContent.tsx',
  'src/components/features/classroom/dialogs/EditClassroomDialog.tsx',
  'src/components/features/onboarding/StudentOnboardingContent.tsx',
  'src/components/features/settings/StudentSettingsContent.tsx',
  'src/components/features/settings/TeacherSettingsContent.tsx',
  'src/components/features/submission/SubmissionDetailContent.tsx',
  'src/contexts/LanguageContext.tsx',
  'src/pages/Landing.tsx',
  'src/utils/roleRecovery.ts',
  'src/utils/sessionState.ts',
];

for (const f of REACT_REFRESH_FILES) addReactRefreshDisable(f);
for (const f of CONSOLE_LOG_FILES) stripConsoleLogs(f);

// authDebug.ts: keep dev logging via console.warn
const authDebugPath = path.join(root, 'src/contexts/auth/authDebug.ts');
if (fs.existsSync(authDebugPath)) {
  let content = fs.readFileSync(authDebugPath, 'utf8');
  content = content.replace(/console\.log\(\.\.\.args\)/, 'console.warn(...args)');
  fs.writeFileSync(authDebugPath, content);
}

// suppressViteHmrLogSpam.ts: eslint-disable for intentional console override
const hmrPath = path.join(root, 'src/dev/suppressViteHmrLogSpam.ts');
if (fs.existsSync(hmrPath)) {
  let content = fs.readFileSync(hmrPath, 'utf8');
  if (!content.includes('no-console')) {
    content =
      '/* eslint-disable no-console -- overrides console methods to suppress Vite HMR spam */\n' +
      content;
    fs.writeFileSync(hmrPath, content);
  }
}

console.log('Batch eslint warning fixes applied.');
