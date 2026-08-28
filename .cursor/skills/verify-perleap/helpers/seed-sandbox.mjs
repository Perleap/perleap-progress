import {
  loadVerifyEnv,
  writeSandboxFixture,
  fail,
} from './shared.mjs';
import { adminRest, listUsersByEmail, adminHeaders } from './supabase-admin.mjs';

const SANDBOX_NAME = 'Verify Sandbox';
const CHAT_ASSIGNMENT_TITLE = 'Verify Chat Smoke';
const ESSAY_ASSIGNMENT_TITLE = 'Verify Essay Smoke';
const MCQ_ASSIGNMENT_TITLE = 'Verify MCQ Smoke';
const TEST_ASSIGNMENT_TITLE = 'Verify Test Smoke';
const ACTIVITY_TITLE = 'Verify Activity Smoke';
const VERIFY_MODULE_TITLE = 'Verify Module';
const VERIFY_SYLLABUS_TITLE = 'Verify Syllabus';

const ASSIGNMENT_DEFAULTS = {
  status: 'published',
  active: true,
  attempt_mode: 'multiple_unlimited',
  enable_ai_feedback: true,
  auto_publish_ai_feedback: true,
  show_task_understanding_prompt: false,
  target_dimensions: [],
  materials: [],
  use_course_memory: false,
};

async function findClassroom(teacherId, env) {
  const rows = await adminRest(
    `/classrooms?name=eq.${encodeURIComponent(SANDBOX_NAME)}&teacher_id=eq.${teacherId}&select=id,name,invite_code`,
    { method: 'GET', prefer: 'return=representation' },
    env,
  );
  return rows?.[0] ?? null;
}

async function createClassroom(teacherId, env) {
  const rows = await adminRest(
    '/classrooms',
    {
      method: 'POST',
      body: JSON.stringify([
        {
          name: SANDBOX_NAME,
          subject: 'Verification',
          teacher_id: teacherId,
          active: true,
        },
      ]),
    },
    env,
  );
  return rows?.[0];
}

async function ensureEnrollment(classroomId, studentId, env) {
  const existing = await adminRest(
    `/enrollments?classroom_id=eq.${classroomId}&student_id=eq.${studentId}&select=id&limit=1`,
    { method: 'GET' },
    env,
  );
  if (existing?.length) return;

  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/enrollments`, {
    method: 'POST',
    headers: {
      ...adminHeaders(env),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([{ classroom_id: classroomId, student_id: studentId, active: true }]),
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    fail(`Enrollment insert failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function findAssignmentByTitle(classroomId, title) {
  const rows = await adminRest(
    `/assignments?classroom_id=eq.${classroomId}&title=eq.${encodeURIComponent(title)}&select=id,title,status,type&limit=1`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

async function createAssignment(classroomId, row) {
  const rows = await adminRest('/assignments', {
    method: 'POST',
    body: JSON.stringify([{ classroom_id: classroomId, ...ASSIGNMENT_DEFAULTS, ...row }]),
  });
  return rows?.[0];
}

async function ensurePublished(assignmentId) {
  await adminRest(`/assignments?id=eq.${assignmentId}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({
      status: 'published',
      active: true,
      attempt_mode: 'multiple_unlimited',
      show_task_understanding_prompt: false,
    }),
  });
}

async function ensureAssignment(classroomId, spec) {
  let assignment = await findAssignmentByTitle(classroomId, spec.title);
  if (!assignment) {
    assignment = await createAssignment(classroomId, spec);
    console.log(`verify-perleap seed: created assignment ${assignment.id} (${spec.title})`);
  } else {
    await ensurePublished(assignment.id);
    console.log(`verify-perleap seed: reusing assignment ${assignment.id} (${spec.title})`);
  }
  return assignment;
}

async function findSyllabus(classroomId) {
  const rows = await adminRest(
    `/syllabi?classroom_id=eq.${classroomId}&active=eq.true&select=id,status&order=created_at.desc&limit=1`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

async function ensurePublishedSyllabus(classroomId) {
  let syllabus = await findSyllabus(classroomId);
  if (!syllabus) {
    const rows = await adminRest('/syllabi', {
      method: 'POST',
      body: JSON.stringify([
        {
          classroom_id: classroomId,
          title: VERIFY_SYLLABUS_TITLE,
          status: 'published',
          active: true,
          structure_type: 'modules',
          release_mode: 'sequential',
          custom_settings: {},
          policies: [],
          published_at: new Date().toISOString(),
        },
      ]),
    });
    syllabus = rows?.[0];
    console.log(`verify-perleap seed: created syllabus ${syllabus.id}`);
  } else if (syllabus.status !== 'published') {
    await adminRest(`/syllabi?id=eq.${syllabus.id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ status: 'published', published_at: new Date().toISOString() }),
    });
    console.log(`verify-perleap seed: published syllabus ${syllabus.id}`);
  } else {
    console.log(`verify-perleap seed: reusing syllabus ${syllabus.id}`);
  }
  return syllabus;
}

async function ensureSyllabusSection(syllabusId) {
  const rows = await adminRest(
    `/syllabus_sections?syllabus_id=eq.${syllabusId}&title=eq.${encodeURIComponent(VERIFY_MODULE_TITLE)}&select=id&limit=1`,
    { method: 'GET' },
  );
  if (rows?.[0]) return rows[0];
  const created = await adminRest('/syllabus_sections', {
    method: 'POST',
    body: JSON.stringify([
      {
        syllabus_id: syllabusId,
        title: VERIFY_MODULE_TITLE,
        order_index: 0,
        active: true,
        completion_status: 'auto',
      },
    ]),
  });
  console.log(`verify-perleap seed: created syllabus section ${created?.[0]?.id}`);
  return created?.[0];
}

async function ensureActivityResource(sectionId) {
  const rows = await adminRest(
    `/activity_list?section_id=eq.${sectionId}&title=eq.${encodeURIComponent(ACTIVITY_TITLE)}&select=id&limit=1`,
    { method: 'GET' },
  );
  if (rows?.[0]) {
    await adminRest(`/activity_list?id=eq.${rows[0].id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ status: 'published', active: true }),
    });
    return rows[0];
  }
  const created = await adminRest('/activity_list', {
    method: 'POST',
    body: JSON.stringify([
      {
        section_id: sectionId,
        title: ACTIVITY_TITLE,
        resource_type: 'lesson',
        lesson_content: {
          version: 1,
          blocks: [
            {
              id: 'verify-smoke-text',
              type: 'text',
              body: 'This is a smoke-test activity for verify-perleap.',
            },
          ],
        },
        status: 'published',
        active: true,
        order_index: 0,
      },
    ]),
  });
  console.log(`verify-perleap seed: created activity ${created?.[0]?.id}`);
  return created?.[0];
}

async function ensureModuleFlowStep(sectionId, activityId) {
  const existing = await adminRest(
    `/module_flow_steps?section_id=eq.${sectionId}&activity_list_id=eq.${activityId}&select=id&limit=1`,
    { method: 'GET' },
  );
  if (existing?.length) return;
  await adminRest('/module_flow_steps', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify([
      {
        section_id: sectionId,
        step_kind: 'resource',
        activity_list_id: activityId,
        order_index: 0,
      },
    ]),
  });
  console.log(`verify-perleap seed: linked module flow step for activity ${activityId}`);
}

async function ensureTestQuestion(assignmentId, question) {
  const existing = await adminRest(
    `/test_questions?assignment_id=eq.${assignmentId}&select=id&limit=1`,
    { method: 'GET' },
  );
  if (existing?.length) return;

  await adminRest('/test_questions', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify([
      {
        assignment_id: assignmentId,
        question_text: question.question_text,
        question_type: 'multiple_choice',
        options: question.options,
        correct_option_ids: question.correct_option_ids,
        correct_option_id: question.correct_option_ids[0] ?? null,
        allow_multiple_selections: false,
        order_index: 0,
      },
    ]),
  });
  console.log(`verify-perleap seed: added test question for assignment ${assignmentId}`);
}

async function main() {
  const env = loadVerifyEnv();
  const teacher = await listUsersByEmail(env.VERIFY_TEACHER_EMAIL, env);
  const student = await listUsersByEmail(env.VERIFY_STUDENT_EMAIL, env);

  let classroom = await findClassroom(teacher.id, env);
  if (!classroom) {
    classroom = await createClassroom(teacher.id, env);
    console.log(`verify-perleap seed: created classroom ${classroom.id}`);
  } else {
    console.log(`verify-perleap seed: reusing classroom ${classroom.id}`);
  }

  await ensureEnrollment(classroom.id, student.id, env);

  const chatAssignment = await ensureAssignment(classroom.id, {
    title: CHAT_ASSIGNMENT_TITLE,
    type: 'discussion_prompt',
    instructions:
      'Have a brief discussion about what you learned today. Answer in one or two sentences when the assistant asks.',
    student_facing_task: 'Discuss what you learned today in 1–2 short messages.',
  });

  const essayAssignment = await ensureAssignment(classroom.id, {
    title: ESSAY_ASSIGNMENT_TITLE,
    type: 'text_essay',
    instructions: 'Write one short paragraph about verification testing.',
    student_facing_task: 'Write a brief paragraph about why automated tests help.',
  });

  const mcqAssignment = await ensureAssignment(classroom.id, {
    title: MCQ_ASSIGNMENT_TITLE,
    type: 'test',
    instructions: 'Answer the multiple choice question.',
    student_facing_task: 'Select the correct answer.',
  });
  await ensureTestQuestion(mcqAssignment.id, {
    question_text: 'What is 2 + 2?',
    options: [
      { id: 'a', text: '3' },
      { id: 'b', text: '4' },
      { id: 'c', text: '5' },
    ],
    correct_option_ids: ['b'],
  });

  const testAssignment = await ensureAssignment(classroom.id, {
    title: TEST_ASSIGNMENT_TITLE,
    type: 'test',
    instructions: 'Answer the test question.',
    student_facing_task: 'Select the correct capital city.',
  });
  await ensureTestQuestion(testAssignment.id, {
    question_text: 'What is the capital of France?',
    options: [
      { id: 'a', text: 'London' },
      { id: 'b', text: 'Paris' },
      { id: 'c', text: 'Berlin' },
    ],
    correct_option_ids: ['b'],
  });

  const syllabus = await ensurePublishedSyllabus(classroom.id);
  const section = await ensureSyllabusSection(syllabus.id);
  const activity = await ensureActivityResource(section.id);
  await ensureModuleFlowStep(section.id, activity.id);

  const fixture = {
    classroomId: classroom.id,
    inviteCode: classroom.invite_code,
    chatAssignmentId: chatAssignment.id,
    essayAssignmentId: essayAssignment.id,
    mcqAssignmentId: mcqAssignment.id,
    testAssignmentId: testAssignment.id,
    activityResourceId: activity.id,
    teacherUserId: teacher.id,
    studentUserId: student.id,
    seededAt: new Date().toISOString(),
  };
  writeSandboxFixture(fixture);

  console.log('verify-perleap seed: wrote fixtures/sandbox.json');
  console.log(`  classroomId=${fixture.classroomId}`);
  console.log(`  inviteCode=${fixture.inviteCode}`);
  console.log(`  chatAssignmentId=${fixture.chatAssignmentId}`);
  console.log(`  essayAssignmentId=${fixture.essayAssignmentId}`);
  console.log(`  mcqAssignmentId=${fixture.mcqAssignmentId}`);
  console.log(`  testAssignmentId=${fixture.testAssignmentId}`);
  console.log(`  activityResourceId=${fixture.activityResourceId}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
