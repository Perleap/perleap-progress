import { buildVerifyUrl, fail, navigationWaitUntil } from '../helpers/shared.mjs';
import { adminRest } from '../helpers/supabase-admin.mjs';
import { abilities as fetchAbilities } from './fetch-data.mjs';

export async function dismissAssignmentIntro(page) {
  const gotIt = page.getByRole('button', { name: 'Got it' });
  if (await gotIt.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await gotIt.click();
  }
  const yes = page.getByRole('button', { name: 'Yes, I understand' });
  if (await yes.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await yes.click();
  }
  const continueToAssignment = page.getByRole('button', { name: 'Continue to assignment' });
  if (await continueToAssignment.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await continueToAssignment.click();
  }
}

async function ensureFreshChatAttempt(page) {
  const startAnother = page.getByRole('button', { name: 'Start another attempt' });
  if (await startAnother.isVisible({ timeout: 5_000 }).catch(() => false)) {
    if (await startAnother.isEnabled().catch(() => false)) {
      await startAnother.click();
      await page.waitForTimeout(2_000);
    }
  }
}

async function waitForChatInput(page) {
  const chatInput = page.getByPlaceholder('Type your message here...');
  const startAnother = page.getByRole('button', { name: 'Start another attempt' });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await chatInput.isVisible().catch(() => false)) {
      return chatInput;
    }
    if (await startAnother.isVisible().catch(() => false)) {
      if (await startAnother.isEnabled().catch(() => false)) {
        await startAnother.click();
        await page.waitForTimeout(2_000);
      }
    }
    await page.waitForTimeout(500);
  }
  await chatInput.waitFor({ timeout: 5_000 });
  return chatInput;
}

async function waitForChatIdle(page) {
  const completeBtn = page.getByRole('button', { name: 'Complete Activity' });
  await completeBtn.waitFor({ timeout: 60_000 });
  for (let i = 0; i < 120; i++) {
    if (!(await completeBtn.isDisabled())) return;
    await page.waitForTimeout(500);
  }
  fail('Chat stayed busy too long while waiting for AI');
}

async function sendChatMessage(page, chatInput, text) {
  await chatInput.fill(text);
  await chatInput.press('Enter');
  await waitForChatIdle(page);
}

async function waitForSubmissionCompleted(ctx, assignmentId, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const fetchResult = await fetchAbilities.fetchAssignment.run({
      ...ctx,
      abilityArgs: { assignmentId },
    });
    if (fetchResult.data?.submission?.status === 'completed') {
      return fetchResult;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  const last = await fetchAbilities.fetchAssignment.run({
    ...ctx,
    abilityArgs: { assignmentId },
  });
  return last;
}

export async function resetSandboxChatSubmissions(fixture, env) {
  if (!fixture?.chatAssignmentId || !fixture?.studentUserId) return;
  const subs = await adminRest(
    `/submissions?assignment_id=eq.${fixture.chatAssignmentId}&student_id=eq.${fixture.studentUserId}&select=id`,
    { method: 'GET' },
    env,
  );
  for (const sub of subs ?? []) {
    await adminRest(
      `/submissions?id=eq.${sub.id}`,
      { method: 'DELETE', prefer: 'return=minimal' },
      env,
    );
  }
}

/** @deprecated use resetSandboxChatSubmissions */
export async function resetInProgressSubmission(fixture, env) {
  await resetSandboxChatSubmissions(fixture, env);
}

export const abilities = {
  openChatAssignment: {
    role: 'student',
    async run(ctx) {
      const assignmentId = ctx.abilityArgs.assignmentId ?? ctx.fixture?.chatAssignmentId;
      if (!assignmentId) fail('openChatAssignment needs assignmentId or sandbox fixture');
      await ctx.page.goto(buildVerifyUrl(`/student/assignment/${assignmentId}`, ctx.env), {
        waitUntil: navigationWaitUntil(ctx.env),
        timeout: 60_000,
      });
      await dismissAssignmentIntro(ctx.page);
      await ensureFreshChatAttempt(ctx.page);
      await dismissAssignmentIntro(ctx.page);
      await waitForChatInput(ctx.page);
      return {
        proof: `Opened chat assignment ${assignmentId}`,
        data: { assignmentId, url: ctx.page.url() },
      };
    },
  },

  completeChatAssignment: {
    role: 'student',
    async run(ctx) {
      await resetSandboxChatSubmissions(ctx.fixture, ctx.env);
      await abilities.openChatAssignment.run(ctx);

      const chatInput = await waitForChatInput(ctx.page);
      await waitForChatIdle(ctx.page);

      const messages = [
        'Today I learned how automated verification can log in as a student and walk through real assignments.',
        'In one sentence: I learned that Perleap can use Playwright plus Supabase to prove chat assignments work end-to-end.',
        'That is everything I learned today — verification tests can complete a discussion and submit for feedback.',
      ];

      for (const text of messages) {
        if (await ctx.page.getByText(/Conversation complete!/i).isVisible().catch(() => false)) {
          break;
        }
        await sendChatMessage(ctx.page, chatInput, text);
      }

      await ctx.page
        .getByText(/Conversation complete!/i)
        .waitFor({ timeout: 60_000 })
        .catch(() => {});

      const completeBtn = ctx.page.getByRole('button', { name: 'Complete Activity' });
      await waitForChatIdle(ctx.page);
      await completeBtn.click();

      await ctx.page.waitForTimeout(2_000);
      const completing = ctx.page.getByText(/Completing activity|Generating feedback/i);
      if (await completing.isVisible().catch(() => false)) {
        await completing.waitFor({ state: 'hidden', timeout: 90_000 }).catch(() => {});
      }

      const fetchResult = await waitForSubmissionCompleted(
        ctx,
        ctx.fixture?.chatAssignmentId,
      );

      if (fetchResult.data?.submission?.status !== 'completed') {
        fail(
          `Expected submission status completed, got ${fetchResult.data?.submission?.status ?? 'none'}`,
        );
      }

      return {
        proof: `Chat assignment completed; submission status=${fetchResult.data.submission.status}`,
        data: fetchResult.data,
      };
    },
  },
};

export function getAbility(name) {
  return abilities[name] ?? null;
}

export function listAbilities() {
  return Object.keys(abilities);
}
