import {
  buildVerifyUrl,
  fail,
  navigationWaitUntil,
} from '../helpers/shared.mjs';
import { dismissAssignmentIntro } from './complete-chat-assignment.mjs';

export function requireSandboxFixture(fixture) {
  if (!fixture?.classroomId) {
    fail('fixtures/sandbox.json missing. Run: npm run verify:seed');
  }
  return fixture;
}

export async function openStudentSandboxClassroom(page, env, fixture) {
  const f = requireSandboxFixture(fixture);
  await page.goto(buildVerifyUrl(`/student/classroom/${f.classroomId}`, env), {
    waitUntil: navigationWaitUntil(env),
  });
  if (!page.url().includes('/student/classroom/')) {
    fail(`Expected student classroom URL, got ${page.url()}`);
  }
}

export async function openTeacherSandboxClassroom(page, env, fixture) {
  const f = requireSandboxFixture(fixture);
  await page.goto(buildVerifyUrl(`/teacher/classroom/${f.classroomId}`, env), {
    waitUntil: navigationWaitUntil(env),
  });
  if (!page.url().includes('/teacher/classroom/')) {
    fail(`Expected teacher classroom URL, got ${page.url()}`);
  }
}

export async function clickClassroomSection(page, sectionLabel) {
  const btn = page.getByRole('button', { name: sectionLabel, exact: true });
  await btn.waitFor({ timeout: 15_000 });
  await btn.click();
  await page.waitForTimeout(500);
}

export async function ensureFreshAttemptIfNeeded(page) {
  const startAnother = page.getByRole('button', { name: 'Start another attempt' });
  if (await startAnother.isVisible({ timeout: 5_000 }).catch(() => false)) {
    if (await startAnother.isEnabled().catch(() => false)) {
      await startAnother.click();
      await page.waitForTimeout(2_000);
    }
  }
}

export async function openStudentActivity(page, env, classroomId, activityResourceId) {
  await page.goto(
    buildVerifyUrl(`/student/classroom/${classroomId}/activity/${activityResourceId}`, env),
    {
    waitUntil: navigationWaitUntil(env),
  });
  if (!page.url().includes('/activity/')) {
    fail(`Expected student activity URL, got ${page.url()}`);
  }
}

export async function openStudentAssignment(page, env, assignmentId, { freshAttempt = false } = {}) {
  await page.goto(buildVerifyUrl(`/student/assignment/${assignmentId}`, env), {
    waitUntil: navigationWaitUntil(env),
  });
  await dismissAssignmentIntro(page);
  if (freshAttempt) {
    await ensureFreshAttemptIfNeeded(page);
    await dismissAssignmentIntro(page);
  }
}
