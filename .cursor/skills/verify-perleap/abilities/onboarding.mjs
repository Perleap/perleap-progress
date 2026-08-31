import { navigationWaitUntil, fail } from '../helpers/shared.mjs';

export async function completeStudentOnboarding(page, cfg) {
  await page.goto(`${cfg.VERIFY_BASE_URL}/onboarding/student`, {
    waitUntil: navigationWaitUntil(cfg),
  });
  await page.getByText('Student Profile Setup').waitFor({ timeout: 30_000 });

  await page.getByLabel('Full Name *').fill('Verify Onboarding Student');
  await page.getByText('Visual Learning', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByText('Independent Learning', { exact: true }).click();
  await page.getByText('Structured Schedule', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByText('Curiosity', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByText('Give me hints or clues to figure it out myself', { exact: true }).click();
  await page.getByText('Someone who is patient and understanding', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByText('Immediate feedback while I\'m practicing', { exact: true }).click();
  await page.getByPlaceholder('e.g., Improve my grade').fill('Verify automated onboarding QA');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Complete Setup' }).click();
  await page.waitForURL(/\/student\/dashboard/, { timeout: 90_000 });
  await page.getByRole('heading', { name: 'Student Dashboard' }).waitFor({ timeout: 30_000 });
}

export async function completeTeacherOnboarding(page, cfg) {
  await page.goto(`${cfg.VERIFY_BASE_URL}/onboarding/teacher`, {
    waitUntil: navigationWaitUntil(cfg),
  });
  await page.getByText('Teacher Profile Setup').waitFor({ timeout: 30_000 });

  await page.getByLabel('Full Name *').fill('Verify Onboarding Teacher');
  await page.getByLabel('Subjects You Teach *').fill('Verification');
  await page.getByLabel('Years of Teaching Experience *').fill('3');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByPlaceholder('Short description (1-2 sentences)').fill('Help students learn through verification tests.');
  await page.getByPlaceholder('How would you describe your approach to teaching?').fill('Patient and structured.');
  await page.getByPlaceholder('How do you explain a concept or give feedback to students?').fill('I use clear examples.');
  await page.getByRole('button', { name: 'Complete Setup' }).click();
  await page.waitForURL(/\/teacher\/dashboard/, { timeout: 90_000 });
  await page.getByText("My Perleap's Classrooms").waitFor({ timeout: 30_000 });
}

export function requireOnboardingLanding(page, expectedPath) {
  const pathname = new URL(page.url()).pathname;
  if (pathname !== expectedPath) {
    fail(`Expected onboarding path ${expectedPath}, got ${pathname}`);
  }
}
