#!/usr/bin/env node
/**
 * Headed manual staging QA (sections 5A–5G). Watch live with VERIFY_HEADED=1 in .env.verify.staging.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dismissAssignmentIntro, resetInProgressSubmission } from '../abilities/complete-chat-assignment.mjs';
import { openStudentAssignment, openStudentSandboxClassroom, openTeacherSandboxClassroom } from '../abilities/navigate.mjs';
import {
  authStatePath,
  buildVerifyUrl,
  evidenceDirForRun,
  fail,
  loadSandboxFixture,
  loadVerifyEnv,
  navigationWaitUntil,
  parseArgs,
  REPO_ROOT,
} from './shared.mjs';
import { adminRest } from './supabase-admin.mjs';
import { openBrowserContext, closeBrowserContext } from '../abilities/browser-context.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const runId = args.run ?? `manual-live-${new Date().toISOString().slice(0, 10)}`;
const env = loadVerifyEnv();
const manualDir = path.join(evidenceDirForRun(runId), 'manual');
fs.mkdirSync(manualDir, { recursive: true });

/** @type {{ id: string, section: string, status: 'PASS'|'FAIL'|'SKIP', note?: string }[]} */
const results = [];

function slug(id) {
  return id.replace(/[^a-z0-9-]/gi, '_');
}

async function shot(page, id) {
  const file = path.join(manualDir, `${slug(id)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function check(section, id, fn) {
  console.log(`\n--- [${section}] ${id} ---`);
  try {
    await fn();
    results.push({ id, section, status: 'PASS' });
    console.log(`PASS: ${id}`);
  } catch (err) {
    const note = err instanceof Error ? err.message : String(err);
    results.push({ id, section, status: 'FAIL', note });
    console.error(`FAIL: ${id} — ${note}`);
  }
}

async function skip(section, id, reason) {
  results.push({ id, section, status: 'SKIP', note: reason });
  console.log(`SKIP: ${id} — ${reason}`);
}

function refreshAuth(role) {
  const r = spawnSync('npm', ['run', 'verify:login', '--', '--role', role], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, VERIFY_PROFILE: 'staging', VERIFY_KEEP_OPEN: '0' },
    cwd: REPO_ROOT,
  });
  if (r.status !== 0) fail(`verify:login --role ${role} failed`);
}

function ensureAuth(role) {
  const p = authStatePath(role);
  if (!fs.existsSync(p)) {
    refreshAuth(role);
  }
}

async function waitForStudentDashboard(page) {
  await page.waitForURL(/\/student\/dashboard/, { timeout: 60_000 });
  await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 30_000 });
}

async function setStudentLanguage(page, lang) {
  await page.evaluate((code) => {
    localStorage.setItem('language_preference', code);
  }, lang);
  await page.reload({ waitUntil: navigationWaitUntil(env) });
  await pause(page, 1500);
}

async function openStudentContext() {
  const ctx = await openBrowserContext({ role: 'student', env });
  await ctx.page.goto(buildVerifyUrl('/student/dashboard', env), {
    waitUntil: navigationWaitUntil(env),
  });
  await setStudentLanguage(ctx.page, 'en');
  return ctx;
}

async function pause(page, ms = 1200) {
  await page.waitForTimeout(ms);
}

async function section5A(fixture) {
  ensureAuth('student');
  ensureAuth('teacher');
  const { page, browser } = await openStudentContext();

  await check('5A', 'student-refresh-auth', async () => {
    await page.reload({ waitUntil: navigationWaitUntil(env) });
    await waitForStudentDashboard(page);
    await shot(page, '5A-student-refresh');
  });

  await check('5A', 'expired-session-redirect', async () => {
    await browser.close();
    const anonCtx = await openBrowserContext({ role: 'anonymous', env });
    try {
      await anonCtx.page.goto(buildVerifyUrl(`/teacher/classroom/${fixture.classroomId}`, env), {
        waitUntil: navigationWaitUntil(env),
      });
      await anonCtx.page.waitForURL(/\/auth/, { timeout: 30_000 });
      await shot(anonCtx.page, '5A-auth-redirect');
    } finally {
      await anonCtx.browser.close();
    }
  });

  const teacherCtx = await openBrowserContext({ role: 'teacher', env });
  const tpage = teacherCtx.page;

  await check('5A', 'delete-account-cancel', async () => {
    await tpage.goto(buildVerifyUrl('/teacher/settings', env), {
      waitUntil: navigationWaitUntil(env),
    });
    const deleteAccountBtn = tpage.getByRole('button', { name: 'Delete Account' });
    await deleteAccountBtn.scrollIntoViewIfNeeded();
    await deleteAccountBtn.click();
    await tpage.getByRole('alertdialog').waitFor({ timeout: 15_000 });
    await tpage.getByPlaceholder('confirm').fill('wrong');
    const confirmDeleteBtn = tpage.getByRole('button', { name: 'Delete My Account' });
    if (await confirmDeleteBtn.isEnabled().catch(() => false)) {
      throw new Error('Delete enabled with wrong confirm text');
    }
    await tpage.getByRole('button', { name: 'Cancel' }).click();
    await shot(tpage, '5A-delete-cancel');
  });

  await closeBrowserContext({ ...teacherCtx, env, allowProcessExit: false });
}

async function createThrowawayClassroom(page) {
  const name = `QA Throwaway ${Date.now()}`;
  await page.goto(buildVerifyUrl('/teacher/dashboard', env), {
    waitUntil: navigationWaitUntil(env),
  });
  await page.waitForURL(/\/teacher\/dashboard/, { timeout: 60_000 });
  const createBtn = page.getByRole('button', { name: 'Create Classroom' }).first();
  await createBtn.waitFor({ state: 'visible', timeout: 45_000 });
  await createBtn.scrollIntoViewIfNeeded();
  await createBtn.click();
  await page.getByRole('heading', { name: 'Create New Classroom' }).waitFor({ timeout: 20_000 });
  await page.getByLabel(/Main Subject or Course Title/i).fill(name);
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'Next' }).click();
    await pause(page, 800);
  }
  await page.getByRole('button', { name: 'Create Classroom' }).last().click();
  await page.waitForURL(/\/teacher\/classroom\//, { timeout: 120_000 });
  const classroomId = page.url().match(/\/teacher\/classroom\/([^/?]+)/)?.[1];
  if (!classroomId) throw new Error(`No classroom id in URL: ${page.url()}`);
  return { classroomId, name };
}

async function clearChatSubmissionsForPaste(fixture) {
  if (!fixture?.chatAssignmentId || !fixture?.studentUserId) return;
  const subs = await adminRest(
    `/submissions?assignment_id=eq.${fixture.chatAssignmentId}&student_id=eq.${fixture.studentUserId}&select=id`,
    { method: 'GET' },
    env,
  );
  for (const sub of subs ?? []) {
    await adminRest(`/submissions?id=eq.${sub.id}`, { method: 'DELETE', prefer: 'return=minimal' }, env);
  }
}

async function waitForChatTextarea(page) {
  const textarea = page.locator('textarea').last();
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const count = await page.locator('textarea').count();
    if (count > 0) {
      const enabled = await textarea.isEnabled().catch(() => false);
      const visible = await textarea.isVisible().catch(() => false);
      if (enabled && visible) return textarea;
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error('Chat textarea did not become visible and enabled');
}

async function dispatchPasteIntoInput(input, text) {
  await input.evaluate((el, pasteText) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', pasteText);
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, text);
}

async function waitForClipboardPasteInDb(fixture, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await adminRest(
      `/assignment_clipboard_events?assignment_id=eq.${fixture.chatAssignmentId}&event_type=eq.paste&select=id&limit=1`,
      { method: 'GET' },
      env,
    );
    if (Array.isArray(rows) && rows.length > 0) return;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error('Paste event not recorded in assignment_clipboard_events');
}

async function openSidebarLanguageMenu(page) {
  const userMenu = page.locator('[data-sidebar="footer"] [aria-haspopup="menu"]');
  await userMenu.waitFor({ state: 'visible', timeout: 15_000 });
  await userMenu.click();
  await page.getByRole('menu').waitFor({ state: 'visible', timeout: 10_000 });
  const languageEntry = page.getByRole('menuitem', { name: 'Language' });
  if (await languageEntry.isVisible().catch(() => false)) {
    await languageEntry.click();
    return;
  }
  await page.locator('[role="menu"]').getByText('Language', { exact: true }).click();
}

async function clickCurriculumTab(page) {
  const curriculumBtn = page.getByRole('button', {
    name: /^(Curriculum|תוכנית לימודים)$/,
    exact: true,
  });
  await curriculumBtn.waitFor({ state: 'visible', timeout: 30_000 });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const disabled = await curriculumBtn.getAttribute('aria-disabled');
    if (disabled !== 'true') break;
    await page.waitForTimeout(250);
  }
  await curriculumBtn.click();
  await page
    .getByRole('heading', { name: /^(Curriculum|תוכנית לימודים)$/ })
    .waitFor({ timeout: 30_000 });
}

async function enrollVerifyStudent(classroomId, fixture) {
  if (!fixture?.studentUserId) return;
  await adminRest(
    '/enrollments',
    {
      method: 'POST',
      body: JSON.stringify([
        {
          classroom_id: classroomId,
          student_id: fixture.studentUserId,
          active: true,
        },
      ]),
    },
    env,
  );
}

async function section5B(fixture) {
  ensureAuth('teacher');
  const { page, browser } = await openBrowserContext({ role: 'teacher', env });
  let throwaway = { classroomId: '', name: '' };

  await check('5B', 'create-throwaway-classroom', async () => {
    throwaway = await createThrowawayClassroom(page);
    await enrollVerifyStudent(throwaway.classroomId, fixture);
    await page.reload({ waitUntil: navigationWaitUntil(env) });
    await pause(page, 3_000);
    await shot(page, '5B-throwaway-created');
  });

  if (throwaway.classroomId) {
    await check('5B', 'reset-preview-and-confirm', async () => {
      await page.getByRole('button', { name: 'Reset classroom' }).scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: 'Reset classroom' }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByText(/Will be removed/i).first().waitFor({ timeout: 20_000 });
      await page.getByLabel(/type the classroom name/i).fill('wrong-name');
      const resetBtn = page.getByRole('button', { name: 'Reset classroom' }).last();
      if (await resetBtn.isEnabled().catch(() => false)) {
        throw new Error('Reset enabled with wrong classroom name');
      }
      await page.getByLabel(/type the classroom name/i).fill(throwaway.name);
      await resetBtn.click();
      await page.waitForTimeout(5_000);
      await shot(page, '5B-after-reset');
    });

    await check('5B', 'delete-throwaway-classroom', async () => {
      await page.getByRole('button', { name: 'Delete Classroom' }).scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: 'Delete Classroom' }).click();
      await page.getByRole('button', { name: 'Delete Classroom' }).last().click();
      await page.waitForURL(/\/teacher\/dashboard/, { timeout: 60_000 });
      await shot(page, '5B-after-delete');
    });
  }

  if (!env.VERIFY_KEEP_OPEN) await browser.close();
  else console.log('verify-perleap: VERIFY_KEEP_OPEN=1 — teacher browser left open after 5B');
  return throwaway;
}

async function section5C(fixture) {
  ensureAuth('student');
  ensureAuth('teacher');
  const pasteText = `QA clipboard paste ${Date.now()}`;
  await resetInProgressSubmission(fixture, env);
  const studentCtx = await openStudentContext();
  const { page, browser, context } = studentCtx;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await check('5C', 'student-paste-in-chat', async () => {
    await openStudentAssignment(page, env, fixture.chatAssignmentId, { freshAttempt: true });
    const chatInput = await waitForChatTextarea(page);
    await dispatchPasteIntoInput(chatInput, pasteText);
    await chatInput.fill(pasteText);
    await chatInput.press('Enter');
    await pause(page, 12_000);
    await waitForClipboardPasteInDb(fixture);
    await shot(page, '5C-student-paste');
  });

  await browser.close();

  const tctx = await openBrowserContext({ role: 'teacher', env });
  const tpage = tctx.page;

  await check('5C', 'teacher-clipboard-badge', async () => {
    await openTeacherSandboxClassroom(tpage, env, fixture);
    await tpage.getByRole('button', { name: 'Submissions', exact: true }).click();
    await pause(tpage, 2_000);
    const badge = tpage.getByText(/Copied|Pasted|Copied & pasted/i).first();
    try {
      await badge.waitFor({ timeout: 20_000 });
    } catch {
      const subs = await adminRest(
        `/submissions?assignment_id=eq.${fixture.chatAssignmentId}&student_id=eq.${fixture.studentUserId}&select=id&order=submitted_at.desc.nullslast&limit=1`,
        { method: 'GET' },
        env,
      );
      const submissionId = subs?.[0]?.id;
      if (!submissionId) throw new Error('No submission row for clipboard badge check');
      await tpage.goto(buildVerifyUrl(`/teacher/submission/${submissionId}`, env), {
        waitUntil: navigationWaitUntil(env),
      });
      await tpage
        .getByText(/Copy & paste activity|Pasted|Copied/i)
        .first()
        .waitFor({ timeout: 30_000 });
    }
    await shot(tpage, '5C-teacher-badge');
  });

  await closeBrowserContext({ ...tctx, env, allowProcessExit: false });
}

async function section5D(fixture) {
  ensureAuth('teacher');
  const { page, browser } = await openBrowserContext({ role: 'teacher', env });

  await check('5D', 'analytics-tab-charts', async () => {
    await openTeacherSandboxClassroom(page, env, fixture);
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await page.getByText('Analytics').first().waitFor({ timeout: 30_000 });
    await shot(page, '5D-analytics');
  });

  await check('5D', 'csv-export', async () => {
    const exportBtn = page.getByRole('button', { name: 'Export CSV' });
    await exportBtn.waitFor({ state: 'visible', timeout: 45_000 });
    await page.waitForFunction(
      () => {
        const btn = [...document.querySelectorAll('button')].find((b) =>
          b.textContent?.includes('Export CSV'),
        );
        return btn && !btn.disabled;
      },
      { timeout: 90_000 },
    );
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await exportBtn.click();
    const download = await downloadPromise;
    if (!download) throw new Error('CSV download did not start');
    await shot(page, '5D-csv-export');
  });

  await check('5D', 'lesson-brief-page', async () => {
    await page.goto(
      buildVerifyUrl(`/teacher/classroom/${fixture.classroomId}/lesson-brief`, env),
      { waitUntil: navigationWaitUntil(env) },
    );
    await page.getByText(/Lesson preparation report|Lesson Brief/i).first().waitFor({
      timeout: 45_000,
    });
    await shot(page, '5D-lesson-brief');
  });

  await check('5D', 'pilot-report-page', async () => {
    await page.goto(
      buildVerifyUrl(`/teacher/classroom/${fixture.classroomId}/pilot-report`, env),
      { waitUntil: navigationWaitUntil(env) },
    );
    await page.waitForTimeout(5_000);
    const body = await page.locator('body').innerText();
    if (!/pilot|report|readiness/i.test(body)) {
      throw new Error('Pilot report content not detected');
    }
    await shot(page, '5D-pilot-report');
  });

  await closeBrowserContext({ browser, env, allowProcessExit: false });
}

async function section5E(fixture) {
  ensureAuth('student');
  const { page, browser } = await openStudentContext();

  await check('5E', 'curriculum-published-only', async () => {
    await openStudentSandboxClassroom(page, env, fixture);
    await page.waitForURL(/\/student\/classroom\//, { timeout: 60_000 });
    await page.getByRole('heading', { level: 2 }).first().waitFor({ timeout: 30_000 });
    await clickCurriculumTab(page);
    await page
      .getByText(/Browse modules, activities, and assignments in course order\.|עברו על מודולים/)
      .waitFor({ timeout: 15_000 });
    const preferredLink = page.locator(
      `a[href*="/student/assignment/${fixture.chatAssignmentId}"]`,
    );
    const anyAssignmentLink = page.locator('a[href*="/student/assignment/"]');
    const linkCount = await anyAssignmentLink.count();
    if (linkCount > 0) {
      const target =
        (await preferredLink.count()) > 0 ? preferredLink.first() : anyAssignmentLink.first();
      await target.scrollIntoViewIfNeeded();
    } else {
      const moduleItems = page.locator('ol li, [data-slot="collapsible-trigger"]');
      if ((await moduleItems.count()) === 0) {
        throw new Error('Curriculum tab has no published assignment links or module items');
      }
    }
    const body = await page.locator('body').innerText();
    if (/\bdraft\b/i.test(body)) {
      throw new Error('Draft assignment visible on student curriculum');
    }
    await shot(page, '5E-curriculum');
  });

  await check('5E', 'test-validation-error', async () => {
    await openStudentAssignment(page, env, fixture.testAssignmentId);
    await dismissAssignmentIntro(page);
    const submit = page.getByRole('button', { name: /Submit|Complete/i }).first();
    if (await submit.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await submit.click();
      await pause(page, 2_000);
    }
    const body = await page.locator('body').innerText();
    if (/something went wrong|blank/i.test(body) && body.length < 50) {
      throw new Error('Blank error screen on test validation');
    }
    await shot(page, '5E-test-validation');
  });

  await closeBrowserContext({ browser, env, allowProcessExit: false });
}

async function section5F() {
  ensureAuth('student');
  const { page, browser } = await openStudentContext();

  await check('5F', 'hebrew-rtl-dashboard', async () => {
    await waitForStudentDashboard(page);
    await setStudentLanguage(page, 'he');
    const html = await page.locator('html').getAttribute('dir');
    if (html !== 'rtl') throw new Error(`Expected dir=rtl, got ${html}`);
    await shot(page, '5F-hebrew');
    await setStudentLanguage(page, 'en');
  });

  await closeBrowserContext({ browser, env, allowProcessExit: false });
}

async function section5G(fixture, throwawayId) {
  if (!throwawayId) {
    await skip('5G', 'course-merge-export-import', 'No throwaway classroom id');
    return;
  }

  ensureAuth('teacher');
  const exportPath = path.join(manualDir, 'sandbox-export-v2.json');
  const v1Path = path.join(manualDir, 'invalid-v1.json');
  fs.writeFileSync(v1Path, JSON.stringify({ version: 1, classroom: { name: 'v1 test' } }));

  const { page, browser } = await openBrowserContext({ role: 'teacher', env });

  await check('5G', 'export-v2-from-sandbox', async () => {
    await openTeacherSandboxClassroom(page, env, fixture);
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;
    await download.saveAs(exportPath);
    if (!fs.existsSync(exportPath)) throw new Error('Export file not saved');
    await shot(page, '5G-export');
  });

  await check('5G', 'merge-into-throwaway', async () => {
    await page.goto(buildVerifyUrl(`/teacher/classroom/${throwawayId}`, env), {
      waitUntil: navigationWaitUntil(env),
    });
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(exportPath);
    await page.getByRole('button', { name: 'Merge into this class' }).waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Merge into this class' }).click();
    await pause(page, 8_000);
    await shot(page, '5G-merge');
  });

  await check('5G', 'v1-import-rejected', async () => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(v1Path);
    await pause(page, 3_000);
    const toast = page.getByText(/v2 merge-safe|importMergeNeedsV2/i);
    if (!(await toast.isVisible({ timeout: 15_000 }).catch(() => false))) {
      const body = await page.locator('body').innerText();
      if (!/v2|merge-safe/i.test(body)) throw new Error('v1 rejection toast not shown');
    }
    await shot(page, '5G-v1-reject');
  });

  await closeBrowserContext({ browser, env, allowProcessExit: false });
}

async function main() {
  console.log(`\n=== Manual staging QA (watch) — ${runId} ===\n`);
  console.log(`Target: ${env.VERIFY_BASE_URL}`);
  console.log(`Evidence: ${manualDir}\n`);

  const fixture = loadSandboxFixture();
  if (!fixture?.classroomId) fail('Run npm run verify:seed first');

  console.log('Refreshing student + teacher auth before manual checks…');
  refreshAuth('student');
  refreshAuth('teacher');

  await section5A(fixture);
  await section5B(fixture);

  let mergeClassroomId = '';
  ensureAuth('teacher');
  const mergeCtx = await openBrowserContext({ role: 'teacher', env });
  await check('5G-setup', 'create-merge-classroom', async () => {
    const t = await createThrowawayClassroom(mergeCtx.page);
    mergeClassroomId = t.classroomId;
  });
  await mergeCtx.browser.close();

  await section5C(fixture);
  await section5D(fixture);
  await section5E(fixture);
  await section5F();
  await section5G(fixture, mergeClassroomId);

  const summary = {
    runId,
    target: env.VERIFY_BASE_URL,
    finishedAt: new Date().toISOString(),
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    skipped: results.filter((r) => r.status === 'SKIP').length,
    results,
  };

  fs.writeFileSync(path.join(manualDir, 'manual-results.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== Manual QA summary ===');
  console.log(`PASS: ${summary.passed}  FAIL: ${summary.failed}  SKIP: ${summary.skipped}`);
  console.log(`Results: ${path.join(manualDir, 'manual-results.json')}`);

  if (summary.failed > 0) {
    fail(`${summary.failed} manual check(s) failed`);
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
