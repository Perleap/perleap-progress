/**
 * Export / import course packages (perleap.course): portable v1, merge-safe v2, merge + full replace imports.
 */
import { supabase, handleSupabaseError } from '@/api/client';
import type { ApiError } from '@/types';
import type { Classroom } from '@/types/models';
import type {
  CoursePackageClassroomV1,
  CoursePackageActivityV1,
  CoursePackageAssignmentV1,
  CoursePackageSectionV1,
  PerleapCoursePackageV1,
  PerleapCoursePackageV2,
} from '@/types/coursePackage';
import type { CreateAssignmentInput } from '@/types/api.types';
import type {
  Syllabus,
  SyllabusPolicy,
  SyllabusPolicyType,
  SyllabusStructureType,
} from '@/types/syllabus';
import { normalizeReleaseMode } from '@/lib/releaseMode';
import { buildCoursePackageV1, buildCoursePackageV2 } from '@/lib/coursePackage/buildCoursePackage';
import type { BuildCoursePackageInput } from '@/lib/coursePackage/buildCoursePackage';
import { getClassroomById, createClassroom, updateClassroom } from '@/services/classroomService';
import {
  getSyllabusByClassroom,
  createSyllabus,
  updateSyllabusSection,
  linkAssignmentToSection,
  deleteSyllabusSection,
  deleteGradingCategory,
} from '@/services/syllabusService';
import {
  getClassroomAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '@/services/assignmentService';
import {
  getModuleFlowStepsBySections,
  replaceModuleFlowSteps,
  type FlowStepInput,
} from '@/services/moduleFlowService';
import { omitOptionalActivityListFields } from '@/lib/activityListOptionalColumns';
import { normalizeAssignmentTypeForImport } from '@/lib/coursePackage/normalizeAssignmentType';
import { createSectionResource } from '@/services/syllabusResourceService';
import { setAssignmentLinkedActivities } from '@/services/assignmentModuleActivityService';
import type { AssignmentModuleActivityInput } from '@/types/syllabus';

export type CoursePackageExportVariant = 'v1_portable' | 'v2_merge';

export { mergeCoursePackageIntoClassroom } from '@/services/coursePackageMergeService';

export type GatherCourseExportResult = {
  data: BuildCoursePackageInput | null;
  error: ApiError | null;
};
/**
 * Load all data needed to build a course package (teacher/admin).
 */
export async function gatherCourseExportData(
  classroomId: string,
  options?: { restrictToTeacherId?: string }
): Promise<GatherCourseExportResult> {
  try {
    const { data: classroom, error: cErr } = await getClassroomById(
      classroomId,
      options?.restrictToTeacherId
    );
    if (cErr) return { data: null, error: cErr };
    if (!classroom) return { data: null, error: { message: 'Classroom not found' } };
    const { data: syllabus, error: sErr } = await getSyllabusByClassroom(classroomId);
    if (sErr) return { data: null, error: sErr };
    const { data: assignments = [], error: aErr } = await getClassroomAssignments(classroomId);
    if (aErr) return { data: null, error: aErr };
    const sectionIds = syllabus?.sections?.length
      ? [...syllabus.sections]
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((s) => s.id)
      : [];
    const { data: moduleFlowSteps = [], error: mErr } =
      await getModuleFlowStepsBySections(sectionIds);
    if (mErr) return { data: null, error: mErr };
    const assignmentIds = (assignments as { id: string }[]).map((a) => a.id);
    const assignmentModuleActivitiesByAssignmentId: Record<
      string,
      import('@/types/syllabus').AssignmentModuleActivity[]
    > = {};
    if (assignmentIds.length > 0) {
      const { data: links, error: lErr } = await supabase
        .from('assignment_module_activities')
        .select('*')
        .in('assignment_id', assignmentIds);
      if (lErr) return { data: null, error: handleSupabaseError(lErr) };
      for (const row of links ?? []) {
        const aid = (row as { assignment_id: string }).assignment_id;
        const list = assignmentModuleActivitiesByAssignmentId[aid] ?? [];
        list.push(row as import('@/types/syllabus').AssignmentModuleActivity);
        assignmentModuleActivitiesByAssignmentId[aid] = list;
      }
    }
    const input: BuildCoursePackageInput = {
      classroom: classroom as Record<string, unknown>,
      syllabus,
      assignments: assignments as unknown as Array<Record<string, unknown>>,
      moduleFlowSteps: moduleFlowSteps ?? [],
      assignmentModuleActivitiesByAssignmentId,
      sourceClassroomName: String((classroom as { name?: string }).name ?? ''),
    };
    return { data: input, error: null };
  } catch (e) {
    return { data: null, error: handleSupabaseError(e) };
  }
}
export async function buildExportPackageForClassroom(
  classroomId: string,
  options?: { restrictToTeacherId?: string; variant?: CoursePackageExportVariant },
): Promise<{ data: PerleapCoursePackageV1 | PerleapCoursePackageV2 | null; error: ApiError | null }> {
  const { data, error } = await gatherCourseExportData(classroomId, options);
  if (error) return { data: null, error };
  if (!data) return { data: null, error: { message: 'No export data' } };
  const variant = options?.variant ?? 'v2_merge';
  if (variant === 'v2_merge') {
    return { data: buildCoursePackageV2(data), error: null };
  }
  return { data: buildCoursePackageV1(data), error: null };
}
async function softDeleteClassroom(classroomId: string): Promise<void> {
  const deletedAt = new Date().toISOString();
  await supabase
    .from('classrooms')
    .update({ active: false, deleted_at: deletedAt } as never)
    .eq('id', classroomId);
}
function policiesForImport(
  raw: { type: string; label: string; content: string; order_index: number }[]
): SyllabusPolicy[] {
  return raw.map((p, i) => ({
    id: crypto.randomUUID(),
    type: p.type as SyllabusPolicyType,
    label: p.label,
    content: p.content,
    order_index: p.order_index ?? i,
  }));
}
function sortSectionsForImport(sections: CoursePackageSectionV1[]): CoursePackageSectionV1[] {
  return [...sections].sort(
    (a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title)
  );
}
/**
 * Applies package syllabus + assignments + flows to an existing classroom (no classroom insert).
 */
export async function applyCoursePackageContentToClassroom(
  classroomId: string,
  pkg: PerleapCoursePackageV1
): Promise<{ error: ApiError | null }> {
  try {
    const syllabusData = pkg.course.syllabus;
    const sectionLocalToId = new Map<string, string>();
    const activityLocalToId = new Map<string, string>();
    const gcLocalToId = new Map<string, string>();
    const assignmentLocalToId = new Map<string, string>();
    if (syllabusData) {
      const { data: syllabus, error: syErr } = await createSyllabus({
        classroom_id: classroomId,
        title: syllabusData.title,
        summary: syllabusData.summary,
        structure_type: syllabusData.structure_type as SyllabusStructureType,
        policies: policiesForImport(syllabusData.policies),
        status: syllabusData.status as Syllabus['status'],
        release_mode: normalizeReleaseMode(syllabusData.release_mode as Syllabus['release_mode']),
        published_at: syllabusData.published_at,
        accent_color: syllabusData.accent_color,
        banner_url: syllabusData.banner_url,
        section_label_override: syllabusData.section_label_override,
        custom_settings: (syllabusData.custom_settings ?? {}) as Syllabus['custom_settings'],
      });
      if (syErr || !syllabus) {
        return { error: syErr ?? { message: 'Failed to create syllabus' } };
      }
      const syllabusId = syllabus.id;
      const validCats = syllabusData.grading_categories.filter((c) => c.name.trim());
      if (validCats.length > 0) {
        const insertPayload = validCats.map((c) => ({
          syllabus_id: syllabusId,
          name: c.name,
          weight: c.weight,
        }));
        const { data: insertedCats, error: catErr } = await supabase
          .from('grading_categories')
          .insert(insertPayload as never)
          .select('id');
        if (catErr) {
          return { error: handleSupabaseError(catErr) };
        }
        validCats.forEach((c, i) => {
          const id = (insertedCats as { id: string }[] | null)?.[i]?.id;
          if (id) gcLocalToId.set(c.local_id, id);
        });
      }
      const sortedSecs = sortSectionsForImport(syllabusData.sections);
      const phaseARows = sortedSecs.map((s) => ({
        syllabus_id: syllabusId,
        title: s.title,
        description: s.description,
        content: s.content,
        order_index: s.order_index,
        start_date: s.start_date,
        end_date: s.end_date,
        objectives: (s.objectives ?? []).filter((o) => o.trim()),
        resources: s.resources,
        notes: s.notes,
        completion_status: s.completion_status,
        prerequisites: [] as string[],
        is_locked: s.is_locked,
      }));
      if (phaseARows.length > 0) {
        const { data: createdSections, error: secErr } = await supabase
          .from('syllabus_sections' as never)
          .insert(phaseARows as never)
          .select('id, order_index');
        if (secErr) {
          return { error: handleSupabaseError(secErr) };
        }
        const rows = ((createdSections as { id: string; order_index: number }[]) ?? []).slice();
        rows.sort((a, b) => a.order_index - b.order_index);
        sortedSecs.forEach((sec, i) => {
          const id = rows[i]?.id;
          if (id) sectionLocalToId.set(sec.local_id, id);
        });
        for (const sec of sortedSecs) {
          const sectionId = sectionLocalToId.get(sec.local_id);
          if (!sectionId) continue;
          const prereqUuids = (sec.prerequisites_local_ids ?? [])
            .map((lid) => sectionLocalToId.get(lid))
            .filter((x): x is string => Boolean(x));
          if (prereqUuids.length > 0) {
            const { error: preErr } = await updateSyllabusSection(sectionId, {
              prerequisites: prereqUuids,
            });
            if (preErr) {
              return { error: preErr };
            }
          }
        }
        for (const sec of sortedSecs) {
          const sectionId = sectionLocalToId.get(sec.local_id);
          if (!sectionId) continue;
          const activities = [...sec.activities].sort((a, b) => a.order_index - b.order_index);
          for (const act of activities) {
            const res = await insertActivityFromPackage(sectionId, act);
            if (res.error) {
              return { error: res.error };
            }
            if (res.id) activityLocalToId.set(act.local_id, res.id);
          }
        }
      }
    }
    const roster: CoursePackageAssignmentV1[] = pkg.course.assignments;
    const linkLists = pkg.course.assignment_activity_links;
    for (let i = 0; i < roster.length; i++) {
      const a = roster[i];
      const createIn: CreateAssignmentInput = {
        classroom_id: classroomId,
        title: a.title,
        instructions: a.instructions,
        type: normalizeAssignmentTypeForImport(a.type),
        due_at: a.due_at,
        status: a.status,
        target_dimensions: a.target_dimensions as unknown as CreateAssignmentInput['target_dimensions'],
        personalization_flag: a.personalization_flag,
        enable_ai_feedback: a.enable_ai_feedback !== false,
        auto_publish_ai_feedback: a.auto_publish_ai_feedback,
        attempt_mode: (a.attempt_mode ?? undefined) as CreateAssignmentInput['attempt_mode'],
      };
      const { data: created, error: assErr } = await createAssignment(createIn);
      if (assErr || !created) {
        return { error: assErr ?? { message: 'Failed to create assignment' } };
      }
      assignmentLocalToId.set(a.local_id, created.id);
      const sectionId = a.syllabus_section_ref
        ? sectionLocalToId.get(a.syllabus_section_ref)
        : undefined;
      const gcId = a.grading_category_ref ? gcLocalToId.get(a.grading_category_ref) : undefined;
      if (sectionId) {
        const { error: linkAssnErr } = await linkAssignmentToSection(
          created.id,
          sectionId,
          gcId ?? null
        );
        if (linkAssnErr) {
          return { error: linkAssnErr };
        }
      } else if (gcId) {
        const { error: gcOnlyErr } = await supabase
          .from('assignments')
          .update({ grading_category_id: gcId } as never)
          .eq('id', created.id);
        if (gcOnlyErr) {
          return { error: handleSupabaseError(gcOnlyErr) };
        }
      }
      const { error: upErr } = await updateAssignment(created.id, {
        materials: a.materials as never,
        student_facing_task: a.student_facing_task,
        hard_skills: a.hard_skills,
        hard_skill_domain: a.hard_skill_domain,
        target_dimensions: a.target_dimensions as never,
      });
      if (upErr) {
        return { error: upErr };
      }
      const links = linkLists[i] ?? [];
      const inputs: AssignmentModuleActivityInput[] = links
        .map((l) => ({
          activity_list_id: activityLocalToId.get(l.activity_ref) ?? '',
          order_index: l.order_index,
          include_in_ai_context: l.include_in_ai_context,
        }))
        .filter((x) => x.activity_list_id);
      if (inputs.length > 0 && sectionId) {
        const { error: linkErr } = await setAssignmentLinkedActivities(
          created.id,
          sectionId,
          inputs
        );
        if (linkErr) {
          return { error: linkErr };
        }
      }
    }
    const flows = pkg.course.module_flow_by_section;
    const syllabusSections = pkg.course.syllabus?.sections;
    if (
      flows &&
      syllabusSections &&
      flows.length === sortSectionsForImport(syllabusSections).length
    ) {
      const sortedSecs = sortSectionsForImport(syllabusSections);
      for (let si = 0; si < sortedSecs.length; si++) {
        const sec = sortedSecs[si];
        const sectionId = sectionLocalToId.get(sec.local_id);
        const rawSteps = flows[si] ?? [];
        if (!sectionId || rawSteps.length === 0) continue;
        const steps: FlowStepInput[] = rawSteps.map((st, ord) => {
          if (st.step_kind === 'resource') {
            const aid = st.activity_ref ? activityLocalToId.get(st.activity_ref) : null;
            return {
              order_index: ord,
              step_kind: 'resource' as const,
              activity_list_id: aid ?? null,
              assignment_id: null,
            };
          }
          const gid = st.assignment_ref ? assignmentLocalToId.get(st.assignment_ref) : null;
          return {
            order_index: ord,
            step_kind: 'assignment' as const,
            activity_list_id: null,
            assignment_id: gid ?? null,
          };
        });
        const { error: flowErr } = await replaceModuleFlowSteps(sectionId, steps);
        if (flowErr) {
          return { error: flowErr };
        }
      }
    }
    return { error: null };
  } catch (e) {
    return { error: handleSupabaseError(e) };
  }
}
/**
 * Tear down syllabus tree + active assignments for a classroom (replace-from-file prerequisite).
 */
export async function tearDownClassroomCurriculum(
  classroomId: string
): Promise<{ error: ApiError | null }> {
  try {
    const { data: assignmentRows, error: assignListErr } = await supabase
      .from('assignments')
      .select('id')
      .eq('classroom_id', classroomId)
      .eq('active', true);
    if (assignListErr) return { error: handleSupabaseError(assignListErr) };
    for (const row of assignmentRows ?? []) {
      const id = (row as { id: string }).id;
      const { success, error } = await deleteAssignment(id);
      if (!success || error)
        return { error: error ?? { message: `Failed to delete assignment ${id}` } };
    }
    const { data: syllabiRows, error: sylErr } = await supabase
      .from('syllabi' as never)
      .select('id')
      .eq('classroom_id', classroomId)
      .eq('active', true);
    if (sylErr) return { error: handleSupabaseError(sylErr) };
    const syllabusIds = (syllabiRows ?? []).map((r) => (r as { id: string }).id);
    const now = new Date().toISOString();
    for (const syllabusId of syllabusIds) {
      const { data: catRows, error: catSelErr } = await supabase
        .from('grading_categories')
        .select('id')
        .eq('syllabus_id', syllabusId);
      if (catSelErr) return { error: handleSupabaseError(catSelErr) };
      const { data: sectionRows, error: secSelErr } = await supabase
        .from('syllabus_sections' as never)
        .select('id')
        .eq('syllabus_id', syllabusId)
        .eq('active', true);
      if (secSelErr) return { error: handleSupabaseError(secSelErr) };
      const sectionIds = (sectionRows ?? []).map((r) => (r as { id: string }).id);
      for (const sectionId of sectionIds) {
        const { error: flowClearErr } = await replaceModuleFlowSteps(sectionId, []);
        if (flowClearErr) return { error: flowClearErr };
      }
      if (sectionIds.length > 0) {
        const { error: alErr } = await supabase
          .from('activity_list')
          .update({ active: false, deleted_at: now } as never)
          .in('section_id', sectionIds);
        if (alErr) return { error: handleSupabaseError(alErr) };
      }
      for (const sectionId of sectionIds) {
        const { error: secDelErr } = await deleteSyllabusSection(sectionId);
        if (secDelErr) return { error: secDelErr };
      }
      for (const c of catRows ?? []) {
        const cid = (c as { id: string }).id;
        const { error: cgErr } = await deleteGradingCategory(cid);
        if (cgErr) return { error: cgErr };
      }
      const { error: syllabusDelErr } = await supabase
        .from('syllabi' as never)
        .update({ active: false, deleted_at: now } as never)
        .eq('id', syllabusId);
      if (syllabusDelErr) return { error: handleSupabaseError(syllabusDelErr) };
    }
    return { error: null };
  } catch (e) {
    return { error: handleSupabaseError(e) };
  }
}
function packageClassroomToUpdatePayload(
  cc: CoursePackageClassroomV1
): Parameters<typeof updateClassroom>[1] {
  const learningOutcomes = cc.learning_outcomes;
  const keyChallenges = cc.key_challenges;
  return {
    name: cc.name.trim(),
    subject: cc.subject ?? '',
    goals: cc.goals,
    course_title: cc.course_title,
    course_duration: cc.course_duration,
    start_date: cc.start_date,
    end_date: cc.end_date,
    course_outline: cc.course_outline,
    resources: cc.resources,
    learning_outcomes: Array.isArray(learningOutcomes)
      ? (learningOutcomes as unknown as string[])
      : null,
    key_challenges: Array.isArray(keyChallenges) ? (keyChallenges as unknown as string[]) : null,
    domains: cc.domains as unknown as Classroom['domains'],
    materials: cc.materials as unknown as Classroom['materials'],
  };
}
/**
 * Replace curriculum in an existing classroom from a v1 package.
 */
export async function replaceCoursePackageInClassroom(params: {
  classroomId: string;
  pkg: PerleapCoursePackageV1;
  updateClassroomFromPackage?: boolean;
  restrictToTeacherId?: string;
}): Promise<{ data: { classroomId: string } | null; error: ApiError | null }> {
  try {
    const { classroomId, pkg, updateClassroomFromPackage, restrictToTeacherId } = params;
    const { data: classroom, error: cErr } = await getClassroomById(
      classroomId,
      restrictToTeacherId
    );
    if (cErr) return { data: null, error: cErr };
    if (!classroom) return { data: null, error: { message: 'Classroom not found' } };
    if (updateClassroomFromPackage) {
      const { error: upErr } = await updateClassroom(
        classroomId,
        packageClassroomToUpdatePayload(pkg.course.classroom)
      );
      if (upErr) return { data: null, error: upErr };
    }
    const { error: teardownErr } = await tearDownClassroomCurriculum(classroomId);
    if (teardownErr) return { data: null, error: teardownErr };
    const { error: applyErr } = await applyCoursePackageContentToClassroom(classroomId, pkg);
    if (applyErr) return { data: null, error: applyErr };
    return { data: { classroomId }, error: null };
  } catch (e) {
    return { data: null, error: handleSupabaseError(e) };
  }
}
/**
 * Creates a new classroom owned by `teacherUserId` from a portable v1 package (logical refs only).
 * `teacherUserId` (auth) owns the classroom; package metadata is never used for authorization.
 * applyCoursePackageContentToClassroom only writes curriculum entities — no learner submissions/progress paths.
 */
export async function importCoursePackageV1(
  pkg: PerleapCoursePackageV1,
  teacherUserId: string
): Promise<{ data: { classroomId: string } | null; error: ApiError | null }> {
  let createdClassroomId: string | null = null;
  try {
    const cc = pkg.course.classroom;
    const learningOutcomes = cc.learning_outcomes;
    const keyChallenges = cc.key_challenges;
    const classroomInsert: Omit<Classroom, 'id' | 'created_at' | 'invite_code'> = {
      name: cc.name.trim(),
      subject: cc.subject ?? '',
      teacher_id: teacherUserId,
      goals: cc.goals,
      course_title: cc.course_title,
      course_duration: cc.course_duration,
      start_date: cc.start_date,
      end_date: cc.end_date,
      course_outline: cc.course_outline,
      resources: cc.resources,
      learning_outcomes: Array.isArray(learningOutcomes)
        ? (learningOutcomes as unknown as string[])
        : null,
      key_challenges: Array.isArray(keyChallenges) ? (keyChallenges as unknown as string[]) : null,
      domains: cc.domains as unknown as Classroom['domains'],
      materials: cc.materials as unknown as Classroom['materials'],
    };
    const { data: classroom, error: crErr } = await createClassroom(classroomInsert);
    if (crErr || !classroom) {
      return { data: null, error: crErr ?? { message: 'Failed to create classroom' } };
    }
    createdClassroomId = classroom.id;
    const { error: applyErr } = await applyCoursePackageContentToClassroom(classroom.id, pkg);
    if (applyErr) {
      if (createdClassroomId) await softDeleteClassroom(createdClassroomId);
      return { data: null, error: applyErr };
    }
    return { data: { classroomId: classroom.id }, error: null };
  } catch (e) {
    if (createdClassroomId) await softDeleteClassroom(createdClassroomId);
    return { data: null, error: handleSupabaseError(e) };
  }
}
async function insertActivityFromPackage(
  sectionId: string,
  act: CoursePackageActivityV1
): Promise<{ id: string | null; error: ApiError | null }> {
  const { data, error } = await createSectionResource(
    omitOptionalActivityListFields({
      section_id: sectionId,
      title: act.title,
      resource_type: act.resource_type as import('@/types/syllabus').ResourceType,
      order_index: act.order_index,
      status: act.status as import('@/types/syllabus').ActivityResourceStatus,
      lesson_content: (act.lesson_content as never) ?? null,
      summary: act.summary,
      body_text: act.body_text,
      file_path: act.file_path,
      url: act.url,
      mime_type: act.mime_type,
      file_size: act.file_size,
      estimated_duration_minutes: act.estimated_duration_minutes,
    }),
  );
  if (error) return { id: null, error };
  return { id: data?.id ?? null, error: null };
}
