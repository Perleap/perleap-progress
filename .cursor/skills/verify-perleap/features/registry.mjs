import { buildVerifyUrl, fail, navigationWaitUntil } from '../helpers/shared.mjs';
import { getAbility as getFetchAbility, listAbilities as listFetchAbilities } from '../abilities/fetch-data.mjs';
import { adminRest } from '../helpers/supabase-admin.mjs';
import {
  getAbility as getChatAbility,
  listAbilities as listChatAbilities,
} from '../abilities/complete-chat-assignment.mjs';
import {
  openStudentSandboxClassroom,
  openTeacherSandboxClassroom,
  clickClassroomSection,
  openStudentAssignment,
  openStudentActivity,
  requireSandboxFixture,
} from '../abilities/navigate.mjs';

import {
  completeStudentOnboarding,
  completeTeacherOnboarding,
} from '../abilities/onboarding.mjs';

const SANDBOX_NAME = 'Verify Sandbox';

const legacyFeatures = {
  'student-auth-dashboard': {
    role: 'student',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/student/dashboard', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByRole('heading', { name: 'Student Dashboard' }).waitFor({ timeout: 30_000 });
      await page.getByText('My Classes').waitFor({ timeout: 10_000 });
      return { proof: 'Student Dashboard heading and My Classes visible' };
    },
  },
  'student-list-classrooms': {
    role: 'student',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/student/dashboard', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByRole('heading', { name: SANDBOX_NAME }).waitFor({ timeout: 30_000 });
      return { proof: `Dashboard lists ${SANDBOX_NAME}` };
    },
  },
  'student-join-class': {
    role: 'student',
    async run(page, cfg) {
      const fixture = cfg.fixture;
      const alreadyEnrolledText = 'You are already enrolled in this classroom';
      await page.goto(buildVerifyUrl('/student/dashboard', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByText('My Classes').waitFor({ timeout: 30_000 });

      const sandboxVisible = await page
        .getByText(SANDBOX_NAME)
        .first()
        .isVisible({ timeout: 30_000 })
        .catch(() => false);
      if (sandboxVisible) {
        return { proof: `Already enrolled in ${SANDBOX_NAME} (seed enrollment)` };
      }

      const invite = fixture?.inviteCode ?? cfg.VERIFY_INVITE_CODE;
      if (!invite) fail('VERIFY_INVITE_CODE or sandbox inviteCode required');
      await page.getByRole('button', { name: 'Join Class' }).click();
      await page.getByRole('dialog').getByLabel('Invite Code').fill(invite);
      await page.getByRole('button', { name: 'Join Classroom' }).click();

      await Promise.race([
        page.getByRole('dialog', { name: 'Join a Classroom' }).waitFor({ state: 'hidden', timeout: 15_000 }),
        page.getByText(SANDBOX_NAME).first().waitFor({ timeout: 15_000 }),
        page.getByText(alreadyEnrolledText).waitFor({ timeout: 15_000 }),
      ]).catch(() => {});

      const dialogVisible = await page
        .getByRole('dialog', { name: 'Join a Classroom' })
        .isVisible()
        .catch(() => false);
      if (dialogVisible) {
        const alreadyEnrolledToast = await page
          .getByText(alreadyEnrolledText)
          .isVisible()
          .catch(() => false);
        const enrolledAfterJoin = await page
          .getByText(SANDBOX_NAME)
          .first()
          .isVisible()
          .catch(() => false);
        if (alreadyEnrolledToast || enrolledAfterJoin) {
          return { proof: `Already enrolled in ${SANDBOX_NAME}` };
        }
        fail('Join classroom dialog still open — check invite code or enrollment state');
      }

      await page.getByText(SANDBOX_NAME).first().waitFor({ timeout: 10_000 });
      return { proof: `Joined classroom with invite ${invite}` };
    },
  },
  'teacher-auth-dashboard': {
    role: 'teacher',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/teacher/dashboard', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByText("My Perleap's Classrooms").waitFor({ timeout: 30_000 });
      const hasEmpty = await page.getByText('No classrooms yet').isVisible();
      const hasCreate = await page.getByRole('button', { name: 'Create Classroom' }).isVisible();
      if (!hasEmpty && !hasCreate) {
        fail('Teacher dashboard missing classrooms section or empty/create controls');
      }
      return { proof: 'Teacher dashboard loaded with My Classrooms section' };
    },
  },
  'teacher-list-classrooms': {
    role: 'teacher',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/teacher/dashboard', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByRole('heading', { name: SANDBOX_NAME }).waitFor({ timeout: 30_000 });
      return { proof: `Teacher dashboard shows ${SANDBOX_NAME}` };
    },
  },
  'teacher-classroom-overview': {
    role: 'teacher',
    async run(page, cfg) {
      const classroomId = cfg.VERIFY_TEACHER_CLASSROOM_ID ?? cfg.fixture?.classroomId;
      if (classroomId) {
        await page.goto(buildVerifyUrl(`/teacher/classroom/${classroomId}`, cfg), {
          waitUntil: navigationWaitUntil(cfg),
        });
      } else {
        await page.goto(buildVerifyUrl('/teacher/dashboard', cfg), { waitUntil: navigationWaitUntil(cfg) });
        const card = page.locator('.cursor-pointer').filter({ has: page.locator('h3') }).first();
        if ((await card.count()) === 0) {
          fail('No classroom card. Run verify:seed or set VERIFY_TEACHER_CLASSROOM_ID.');
        }
        await card.click();
        await page.waitForURL(/\/teacher\/classroom\//, { timeout: 30_000 });
      }
      if (!page.url().includes('/teacher/classroom/')) {
        fail(`Expected classroom detail URL, got ${page.url()}`);
      }
      return { proof: `Teacher classroom detail at ${page.url()}` };
    },
  },
  'student-classroom-detail': {
    role: 'student',
    async run(page, cfg) {
      await openStudentSandboxClassroom(page, cfg, cfg.fixture);
      await page.getByRole('heading', { level: 2 }).first().waitFor({ timeout: 30_000 });
      await page.getByRole('button', { name: 'About' }).waitFor({ timeout: 10_000 });
      return { proof: `Student classroom detail at ${page.url()}` };
    },
  },
  'student-classroom-curriculum': {
    role: 'student',
    async run(page, cfg) {
      await openStudentSandboxClassroom(page, cfg, cfg.fixture);
      await page.getByRole('heading', { level: 2 }).first().waitFor({ timeout: 30_000 });
      const curriculumBtn = page.getByRole('button', { name: 'Curriculum', exact: true });
      const hasCurriculum = await curriculumBtn.isVisible({ timeout: 10_000 }).catch(() => false);
      if (!hasCurriculum) {
        await page.getByRole('button', { name: 'About', exact: true }).waitFor({ timeout: 10_000 });
        return { proof: 'No published syllabus — About tab visible (Curriculum N/A)' };
      }
      await curriculumBtn.waitFor({ state: 'visible', timeout: 30_000 });
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const disabled = await curriculumBtn.getAttribute('aria-disabled');
        if (disabled !== 'true') break;
        await page.waitForTimeout(250);
      }
      await curriculumBtn.click();
      await page.getByRole('heading', { name: 'Curriculum' }).waitFor({ timeout: 30_000 });
      await page
        .getByText('Browse modules, activities, and assignments in course order.')
        .waitFor({ timeout: 15_000 });
      return { proof: 'Student Curriculum tab loaded' };
    },
  },
  'student-view-assignment-list': {
    role: 'student',
    async run(page, cfg) {
      const fixture = requireSandboxFixture(cfg.fixture);
      if (!fixture.chatAssignmentId) fail('sandbox chatAssignmentId missing — run verify:seed');
      await openStudentAssignment(page, cfg, fixture.chatAssignmentId);
      await page.getByRole('heading', { name: 'Verify Chat Smoke' }).waitFor({ timeout: 30_000 });
      return { proof: 'Verify Chat Smoke assignment title visible' };
    },
  },
  'student-assignment-detail': {
    role: 'student',
    async run(page, cfg) {
      const fixture = requireSandboxFixture(cfg.fixture);
      if (!fixture.chatAssignmentId) fail('sandbox chatAssignmentId missing — run verify:seed');
      await openStudentAssignment(page, cfg, fixture.chatAssignmentId, { freshAttempt: true });
      if (!page.url().includes('/student/assignment/')) {
        fail(`Expected student assignment detail URL, got ${page.url()}`);
      }
      await page.getByRole('button', { name: 'Back' }).waitFor({ timeout: 30_000 });
      await page.getByRole('heading', { name: 'Verify Chat Smoke' }).waitFor({ timeout: 30_000 });

      const chatInput = page.getByPlaceholder('Type your message here...');
      const viewFeedback = page.getByRole('heading', { name: 'View Feedback' });
      const assessmentProgress = page.getByText('Your work is submitted. AI evaluation is in progress');
      const startAnother = page.getByRole('button', { name: 'Start another attempt' });

      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        if (await chatInput.isVisible().catch(() => false)) {
          return { proof: `Student assignment detail (chat active) at ${page.url()}` };
        }
        if (await viewFeedback.isVisible().catch(() => false)) {
          return { proof: `Student assignment detail (feedback visible) at ${page.url()}` };
        }
        if (await assessmentProgress.isVisible().catch(() => false)) {
          return { proof: `Student assignment detail (submitted) at ${page.url()}` };
        }
        if (await startAnother.isVisible().catch(() => false)) {
          return { proof: `Student assignment detail (completed, retry offered) at ${page.url()}` };
        }
        await page.waitForTimeout(500);
      }
      fail('Assignment detail shell missing chat, feedback, or completion state');
    },
  },
  'student-settings-profile': {
    role: 'student',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/student/settings', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByLabel('Full Name').waitFor({ timeout: 30_000 });
      return { proof: 'Student settings profile form loaded' };
    },
  },
  'student-open-assignment-readonly': {
    role: 'student',
    async run(page, cfg) {
      const fixture = requireSandboxFixture(cfg.fixture);
      if (!fixture.chatAssignmentId) fail('sandbox chatAssignmentId missing');
      await openStudentAssignment(page, cfg, fixture.chatAssignmentId, { freshAttempt: true });
      const chatInput = page.getByPlaceholder('Type your message here...');
      const viewFeedback = page.getByRole('heading', { name: 'View Feedback' });
      const startAnother = page.getByRole('button', { name: 'Start another attempt' });
      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        if (await chatInput.isVisible().catch(() => false)) {
          return { proof: 'Chat assignment open with input ready (no submit)' };
        }
        if (await viewFeedback.isVisible().catch(() => false)) {
          return { proof: 'Chat assignment open (feedback visible, prior attempt)' };
        }
        if (await startAnother.isVisible().catch(() => false)) {
          if (await startAnother.isEnabled().catch(() => false)) {
            await startAnother.click();
            await page.waitForTimeout(2_000);
            if (await chatInput.isVisible().catch(() => false)) {
              return { proof: 'Chat assignment open after starting fresh attempt' };
            }
          } else {
            return { proof: 'Chat assignment open (retry affordance visible, prior attempt)' };
          }
        }
        await page.waitForTimeout(500);
      }
      fail('Chat assignment missing input, feedback, or retry affordance');
    },
  },
  'student-open-essay': {
    role: 'student',
    async run(page, cfg) {
      const fixture = requireSandboxFixture(cfg.fixture);
      if (!fixture.essayAssignmentId) fail('sandbox essayAssignmentId missing — run verify:seed');
      await openStudentAssignment(page, cfg, fixture.essayAssignmentId);
      const essayInput = page.getByPlaceholder('Write your essay here…');
      const essayTitle = page.getByRole('heading', { name: 'Your response' });
      const startAnother = page.getByRole('button', { name: 'Start another attempt' });
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        if (await essayInput.isVisible().catch(() => false)) {
          return { proof: 'Essay editor loaded' };
        }
        if (await essayTitle.isVisible().catch(() => false)) {
          return { proof: 'Essay submission card loaded' };
        }
        if (
          await page
            .getByText(/AI evaluation is in progress|awaiting teacher review/i)
            .isVisible()
            .catch(() => false)
        ) {
          return { proof: 'Essay assignment open (post-submit state)' };
        }
        if (await startAnother.isVisible().catch(() => false)) {
          return { proof: 'Essay assignment open (retry affordance visible)' };
        }
        await page.waitForTimeout(500);
      }
      fail('Essay assignment did not load');
    },
  },
  'student-open-quiz-mcq': {
    role: 'student',
    async run(page, cfg) {
      const fixture = requireSandboxFixture(cfg.fixture);
      if (!fixture.mcqAssignmentId) fail('sandbox mcqAssignmentId missing — run verify:seed');
      await openStudentAssignment(page, cfg, fixture.mcqAssignmentId);
      await page.getByText('What is 2 + 2?').waitFor({ timeout: 30_000 });
      return { proof: 'MCQ first question visible' };
    },
  },
  'student-open-test-mode': {
    role: 'student',
    async run(page, cfg) {
      const fixture = requireSandboxFixture(cfg.fixture);
      if (!fixture.testAssignmentId) fail('sandbox testAssignmentId missing — run verify:seed');
      await openStudentAssignment(page, cfg, fixture.testAssignmentId);
      await page.getByText('What is the capital of France?').waitFor({ timeout: 30_000 });
      return { proof: 'Test first question visible' };
    },
  },
  'teacher-classroom-students-tab': {
    role: 'teacher',
    async run(page, cfg) {
      await openTeacherSandboxClassroom(page, cfg, cfg.fixture);
      await clickClassroomSection(page, 'Students');
      await page.getByRole('heading', { name: 'Enrolled Students' }).waitFor({ timeout: 30_000 });
      return { proof: 'Teacher Students tab loaded' };
    },
  },
  'teacher-classroom-submissions-tab': {
    role: 'teacher',
    async run(page, cfg) {
      await openTeacherSandboxClassroom(page, cfg, cfg.fixture);
      await clickClassroomSection(page, 'Submissions');
      await page.getByRole('heading', { name: 'Student Submissions' }).waitFor({ timeout: 30_000 });
      return { proof: 'Teacher Submissions tab loaded' };
    },
  },
  'teacher-classroom-analytics-tab': {
    role: 'teacher',
    async run(page, cfg) {
      await openTeacherSandboxClassroom(page, cfg, cfg.fixture);
      await clickClassroomSection(page, 'Analytics');
      await page.getByText('Analytics').first().waitFor({ timeout: 30_000 });
      return { proof: 'Teacher Analytics tab loaded' };
    },
  },
  'teacher-submission-detail': {
    role: 'teacher',
    async run(page, cfg) {
      const assignmentId = cfg.fixture?.chatAssignmentId;
      const studentId = cfg.fixture?.studentUserId;
      if (!assignmentId) fail('Run verify:seed first');
      let query = `/submissions?assignment_id=eq.${assignmentId}&status=eq.completed&is_teacher_attempt=eq.false&select=id&order=submitted_at.desc&limit=1`;
      if (studentId) query += `&student_id=eq.${studentId}`;
      const subs = await adminRest(query, { method: 'GET' }, cfg);
      const submissionId = subs?.[0]?.id;
      if (!submissionId) {
        fail('No completed sandbox submission — run student-complete-chat first.');
      }
      await page.goto(buildVerifyUrl(`/teacher/submission/${submissionId}`, cfg), {
        waitUntil: navigationWaitUntil(cfg),
      });
      if (!page.url().includes('/teacher/submission/')) {
        fail(`Expected teacher submission detail URL, got ${page.url()}`);
      }
      await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 30_000 });
      return { proof: `Teacher submission detail at ${page.url()}` };
    },
  },
  'student-activity-page': {
    role: 'student',
    async run(page, cfg) {
      const fixture = requireSandboxFixture(cfg.fixture ?? cfg);
      if (!fixture.activityResourceId) {
        fail('sandbox activityResourceId missing — re-run verify:seed');
      }
      const env = cfg.VERIFY_BASE_URL ? cfg : cfg;
      await openStudentActivity(page, env, fixture.classroomId, fixture.activityResourceId);
      await page.getByRole('heading', { name: 'Verify Activity Smoke' }).waitFor({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Back' }).waitFor({ timeout: 10_000 });
      return { proof: `Student activity page at ${page.url()}` };
    },
  },
  'marketing-landing-load': {
    role: 'anonymous',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByText('Agentic AI for').waitFor({ timeout: 30_000 });
      await page.getByText('Education', { exact: true }).waitFor({ timeout: 10_000 });
      return { proof: 'Landing hero (title1/title2) visible' };
    },
  },
  'marketing-pricing-load': {
    role: 'anonymous',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/pricing', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByRole('heading', { name: /Choose Your Plan/i }).waitFor({ timeout: 30_000 });
      await page.getByText('Beginner', { exact: true }).first().waitFor({ timeout: 10_000 });
      await page.getByRole('link', { name: 'Contact our sales team' }).waitFor({ timeout: 10_000 });
      return { proof: 'Pricing plan cards and sales CTA to /contact visible' };
    },
  },
  'marketing-contact-load': {
    role: 'anonymous',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/contact', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.locator('[data-slot="card-title"]').filter({ hasText: 'Send us a Message' }).waitFor({ timeout: 30_000 });
      await page.getByLabel('First Name').waitFor({ timeout: 10_000 });
      await page.getByRole('button', { name: 'Send Message' }).waitFor({ timeout: 10_000 });
      return { proof: 'Contact form fields and submit button visible' };
    },
  },
  'marketing-nav-links': {
    role: 'anonymous',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByText('Agentic AI for').waitFor({ timeout: 30_000 });
      await page.getByRole('navigation').getByRole('link', { name: 'Product' }).click();
      await page.getByRole('heading', { name: /Intelligent Agents for/i }).waitFor({ timeout: 30_000 });
      return { proof: 'Navbar Product link navigates to /product' };
    },
  },
  'auth-page-load': {
    role: 'anonymous',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/auth', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByRole('heading', { name: 'Sign in with email' }).waitFor({ timeout: 30_000 });
      return { proof: 'Auth page loads with sign-in form (AuthContent refactor)' };
    },
  },
  'student-dashboard-view-modes': {
    role: 'student',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/student/dashboard', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByRole('heading', { name: 'Student Dashboard' }).waitFor({ timeout: 30_000 });
      const viewSelect = page.getByText('View:').locator('..').getByRole('combobox');
      if (!(await viewSelect.isVisible({ timeout: 5_000 }).catch(() => false))) {
        return { proof: 'No classrooms — view switcher hidden (dashboard OK)' };
      }
      await viewSelect.click();
      await page.getByRole('option', { name: 'Table' }).click();
      await page.getByRole('table').waitFor({ timeout: 15_000 });
      await page.getByText(SANDBOX_NAME).waitFor({ timeout: 15_000 });
      return { proof: 'Student dashboard Table view mode renders (classroomViewMode i18n)' };
    },
  },
  'teacher-settings-profile': {
    role: 'teacher',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/teacher/settings', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByLabel('Full Name').waitFor({ timeout: 30_000 });
      return { proof: 'Teacher settings profile form loaded' };
    },
  },
  'teacher-planner-load': {
    role: 'teacher',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/teacher/planner', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByRole('heading', { name: 'Planner' }).waitFor({ timeout: 30_000 });
      await page.getByText('Manage your schedule and assignments').waitFor({ timeout: 10_000 });
      return { proof: 'Teacher planner calendar shell loaded' };
    },
  },
  'admin-ai-prompts': {
    role: 'admin',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/admin/ai-prompts', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByRole('heading', { name: 'Student chat AI prompts' }).waitFor({ timeout: 30_000 });
      return { proof: 'Admin AI prompts page loaded' };
    },
  },
  'admin-monitoring-overview': {
    role: 'admin',
    async run(page, cfg) {
      await page.goto(buildVerifyUrl('/admin/monitoring', cfg), { waitUntil: navigationWaitUntil(cfg) });
      await page.getByRole('heading', { name: 'Monitoring' }).waitFor({ timeout: 30_000 });
      await page.getByRole('heading', { name: 'At a glance' }).waitFor({ timeout: 15_000 });
      return { proof: 'Admin monitoring overview loaded' };
    },
  },
  'teacher-live-session-open': {
    role: 'teacher',
    async run(page, cfg) {
      const fixture = cfg.fixture;
      const classroomId = fixture?.classroomId ?? cfg.VERIFY_TEACHER_CLASSROOM_ID;
      const assignmentId = fixture?.liveSessionAssignmentId;
      if (!classroomId || !assignmentId) {
        fail('liveSessionAssignmentId missing — re-run verify:seed');
      }
      await page.goto(
        buildVerifyUrl(`/teacher/classroom/${classroomId}/live-session/${assignmentId}`, cfg),
        { waitUntil: navigationWaitUntil(cfg) },
      );
      const notFound = await page
        .getByText('Live session not found.')
        .isVisible()
        .catch(() => false);
      if (notFound) {
        fail('Live session not found — check seed live_sessions row');
      }
      await page.getByText('Summary', { exact: true }).first().waitFor({ timeout: 30_000 });
      await page.getByText('Student evaluations', { exact: true }).waitFor({ timeout: 15_000 });
      return { proof: `Live session ready at ${page.url()}` };
    },
  },
  'student-onboarding-complete': {
    role: 'onboarding-student',
    async run(page, cfg) {
      await completeStudentOnboarding(page, cfg);
      return { proof: 'Student completed 6-step onboarding wizard → dashboard' };
    },
  },
  'teacher-onboarding-complete': {
    role: 'onboarding-teacher',
    async run(page, cfg) {
      await completeTeacherOnboarding(page, cfg);
      return { proof: 'Teacher completed 2-step onboarding wizard → dashboard' };
    },
  },
  'student-complete-chat': {
    role: 'student',
    ability: 'completeChatAssignment',
  },
};

export function getFeature(featureId) {
  return legacyFeatures[featureId] ?? null;
}

export function listFeatures() {
  return Object.keys(legacyFeatures);
}

export async function runFeature(featureId, ctx) {
  const feature = getFeature(featureId);
  if (!feature) {
    fail(`Unknown feature "${featureId}". Known: ${listFeatures().join(', ')}`);
  }

  if (feature.ability) {
    const ability = getChatAbility(feature.ability) ?? getFetchAbility(feature.ability);
    if (!ability) fail(`Feature ${featureId} references unknown ability ${feature.ability}`);
    return ability.run({ ...ctx, role: feature.role });
  }

  const cfg = { ...ctx.env, fixture: ctx.fixture };
  return feature.run(ctx.page, cfg);
}

export function getAllAbilities() {
  return [...listFetchAbilities(), ...listChatAbilities()];
}

export async function runAbilityByName(name, ctx) {
  const ability = getChatAbility(name) ?? getFetchAbility(name);
  if (!ability) {
    fail(`Unknown ability "${name}". Known: ${getAllAbilities().join(', ')}`);
  }
  return ability.run(ctx);
}
