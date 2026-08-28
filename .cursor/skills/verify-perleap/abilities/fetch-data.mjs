import { fail } from '../helpers/shared.mjs';
import { adminRest } from '../helpers/supabase-admin.mjs';

export const abilities = {
  fetchClassroom: {
    role: 'teacher',
    async run(ctx) {
      const classroomId = ctx.abilityArgs.classroomId ?? ctx.fixture?.classroomId;
      if (!classroomId) fail('fetchClassroom needs classroomId or sandbox fixture');
      const rows = await adminRest(
        `/classrooms?id=eq.${classroomId}&select=id,name,invite_code,teacher_id`,
        { method: 'GET' },
        ctx.env,
      );
      const enrollments = await adminRest(
        `/enrollments?classroom_id=eq.${classroomId}&active=eq.true&select=id`,
        { method: 'GET' },
        ctx.env,
      );
      return {
        proof: `Classroom ${rows[0]?.name} with ${enrollments.length} enrollment(s)`,
        data: { classroom: rows[0], enrollmentCount: enrollments.length },
      };
    },
  },

  fetchAssignment: {
    role: 'student',
    async run(ctx) {
      const assignmentId = ctx.abilityArgs.assignmentId ?? ctx.fixture?.chatAssignmentId;
      if (!assignmentId) fail('fetchAssignment needs assignmentId or sandbox fixture');

      const assignments = await adminRest(
        `/assignments?id=eq.${assignmentId}&select=id,title,status,type,classroom_id`,
        { method: 'GET' },
        ctx.env,
      );

      const studentId = ctx.fixture?.studentUserId;
      let submission = null;
      if (studentId) {
        const subs = await adminRest(
          `/submissions?assignment_id=eq.${assignmentId}&student_id=eq.${studentId}&select=id,status,submitted_at&order=submitted_at.desc&limit=1`,
          { method: 'GET' },
          ctx.env,
        );
        submission = subs?.[0] ?? null;
      }

      return {
        proof: `Assignment "${assignments[0]?.title}" submission=${submission?.status ?? 'none'}`,
        data: { assignment: assignments[0], submission },
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
