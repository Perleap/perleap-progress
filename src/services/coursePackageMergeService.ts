/**
 * Merge perleap.course v2 snapshots into an existing classroom (PATCH by UUID; importer does not add submission rows).
 * Optional Postgres RPC merges strict UUID payloads in one transaction when enabled.
 *
 * Ownership / foreign-id policy (TypeScript merge; mirrors merge_course_package_v2 where applicable):
 * - exported_from_classroom_id must match the target classroom — same check in RPC (`exported_from_guard`).
 * - Live syllabus.id must equal snapshot syllabus id (`syllabus_mismatch`).
 * - Section/activity PATCH: assertSectionBelongs / assertActivityBelongsToSection first.
 * - Assignment PATCH: assertAssignmentBelongs(classroom); section/GC refs assert against live syllabus ids.
 * - Grading categories: PATCH only if row exists for this syllabus; otherwise reject foreign syllabus or insert-by-id path.
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type { ApiError, MergeFailureContext } from '@/types';
import type { Classroom } from '@/types/models';
import type {
  CoursePackageCourseV2,
  CoursePackageSectionV2,
  CoursePackageClassroomV1,
  PerleapCoursePackageV2,
} from '@/types/coursePackage';
import type { Syllabus, SyllabusStructureType, ResourceType, ActivityResourceStatus } from '@/types/syllabus';
import type { CreateSyllabusSectionInput } from '@/types/syllabus';
import type { Json } from '@/integrations/supabase/types';
import { normalizeReleaseMode } from '@/lib/releaseMode';
import { packageNeedsTypescriptCourseMerge, shouldUseCoursePackageMergeRpc } from '@/config/mergeCoursePackage';

import { getClassroomById, updateClassroom } from '@/services/classroomService';
import {
  getSyllabusByClassroom,
  updateSyllabus,
  updateSyllabusSection,
  linkAssignmentToSection,
  unlinkAssignmentFromSection,
  createSyllabusSection,
} from '@/services/syllabusService';
import { updateAssignment } from '@/services/assignmentService';
import { replaceModuleFlowSteps, type FlowStepInput } from '@/services/moduleFlowService';
import { createSectionResource, updateSectionResource } from '@/services/syllabusResourceService';
import { setAssignmentLinkedActivities } from '@/services/assignmentModuleActivityService';
import type { AssignmentModuleActivityInput } from '@/types/syllabus';

const MERGE_JSON_PREFIX = 'MERGE_JSON ';

function isUuid(s: string): boolean {
  const t = s.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t);
}

function mergeFail(
  base: ApiError | string | null | undefined,
  ctx: Omit<MergeFailureContext, 'atomic'>,
  atomic: boolean,
): ApiError {
  const message =
    typeof base === 'string' ? base : (base?.message ?? 'Merge failed');
  const code = typeof base === 'object' && base && 'code' in base ? (base as ApiError).code : undefined;
  const prevDetails =
    typeof base === 'object' && base && base.details && typeof base.details === 'object' && base.details !== null
      ? (base.details as Record<string, unknown>)
      : {};
  return {
    message,
    code,
    details: {
      ...prevDetails,
      merge: { ...ctx, atomic } satisfies MergeFailureContext,
    },
  };
}

function parseMergeRpcError(err: unknown): ApiError {
  const base = handleSupabaseError(err);
  const msg = base.message ?? '';
  if (msg.startsWith(MERGE_JSON_PREFIX)) {
    try {
      const parsed = JSON.parse(msg.slice(MERGE_JSON_PREFIX.length)) as Omit<MergeFailureContext, 'atomic'>;
      if (parsed && typeof parsed.phase === 'string') {
        return {
          ...base,
          details: { merge: { ...parsed, atomic: true } satisfies MergeFailureContext },
        };
      }
    } catch {
      /* fall through */
    }
  }
  return {
    ...base,
    details: {
      merge: { phase: 'module_flow', humanLabel: 'RPC', atomic: true } satisfies MergeFailureContext,
    },
  };
}

function packageClassroomToUpdateMerge(cc: CoursePackageClassroomV1): Parameters<typeof updateClassroom>[1] {
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
    domains: cc.domains as Classroom['domains'],
    materials: cc.materials as Classroom['materials'],
  };
}

async function assertAssignmentBelongs(aid: string, classroomId: string): Promise<ApiError | null> {
  const { data, error } = await supabase
    .from('assignments')
    .select('classroom_id, active')
    .eq('id', aid)
    .maybeSingle();
  if (error) return handleSupabaseError(error);
  if (
    !data ||
    !(data as { classroom_id?: string }).classroom_id ||
    (data as { classroom_id: string }).classroom_id !== classroomId
  )
    return { message: 'Assignment does not belong to this classroom.' };
  if ((data as { active?: boolean }).active === false)
    return { message: 'Assignment is inactive; merge skipped for safety.' };
  return null;
}

async function assertSectionBelongs(secId: string, syllabusId: string): Promise<ApiError | null> {
  const { data, error } = await supabase
    .from('syllabus_sections')
    .select('syllabus_id, active')
    .eq('id', secId)
    .maybeSingle();
  if (error) return handleSupabaseError(error);
  const row = data as { syllabus_id?: string; active?: boolean } | null;
  if (!row?.syllabus_id || row.syllabus_id !== syllabusId)
    return { message: 'Syllabus section does not belong to this course outline.' };
  if (row.active === false) return { message: 'Syllabus section is inactive.' };
  return null;
}

async function assertGcBelongs(gcId: string, syllabusId: string): Promise<ApiError | null> {
  const { data, error } = await supabase
    .from('grading_categories')
    .select('syllabus_id')
    .eq('id', gcId)
    .maybeSingle();
  if (error) return handleSupabaseError(error);
  const row = data as { syllabus_id?: string } | null;
  if (!row?.syllabus_id || row.syllabus_id !== syllabusId)
    return { message: 'Grading category does not belong to this syllabus.' };
  return null;
}

async function assertActivityBelongsToSection(
  activityId: string,
  sectionId: string,
): Promise<ApiError | null> {
  const { data, error } = await supabase
    .from('activity_list')
    .select('section_id, active')
    .eq('id', activityId)
    .maybeSingle();
  if (error) return handleSupabaseError(error);
  const row = data as { section_id?: string; active?: boolean } | null;
  if (!row?.section_id || row.section_id !== sectionId)
    return { message: 'Activity row does not belong to this syllabus section.' };
  if (row.active === false) return { message: 'Activity is inactive.' };
  return null;
}

function sortSectionsCourse(course: CoursePackageCourseV2) {
  if (!course.syllabus) return [];
  return [...course.syllabus.sections].sort(
    (a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title),
  );
}

function sectionHumanLabel(sec: CoursePackageSectionV2, indexInPkg: number): string {
  const t = sec.title?.trim();
  if (t) return t;
  return `Section ${indexInPkg + 1}`;
}

function resolveSectionDbId(
  sec: CoursePackageSectionV2,
  insertedSectionIdByLocalId: Map<string, string>,
): string | null {
  const raw = typeof sec.id === 'string' ? sec.id.trim() : '';
  if (raw && isUuid(raw)) return raw;
  const lk = typeof sec.local_id === 'string' ? sec.local_id.trim() : '';
  if (!lk) return null;
  return insertedSectionIdByLocalId.get(lk) ?? null;
}

async function mergeCoursePackageIntoClassroomRpc(params: {
  classroomId: string;
  pkg: PerleapCoursePackageV2;
  updateClassroomFromPackage?: boolean;
  restrictToTeacherId?: string;
}): Promise<{ data: { classroomId: string } | null; error: ApiError | null }> {
  const { classroomId, pkg, updateClassroomFromPackage, restrictToTeacherId } = params;
  const { data: classroomRow, error: cErr } = await getClassroomById(classroomId, restrictToTeacherId);
  if (cErr) return { data: null, error: mergeFail(cErr, { phase: 'classroom_patch' }, true) };
  if (!classroomRow) return { data: null, error: mergeFail('Classroom not found', { phase: 'classroom_patch' }, true) };

  void classroomRow;

  const { error: rpcErr } = await supabase.rpc('merge_course_package_v2', {
    p_classroom_id: classroomId,
    p_pkg: pkg as unknown as Json,
    p_update_classroom: Boolean(updateClassroomFromPackage),
  });

  if (rpcErr) return { data: null, error: parseMergeRpcError(rpcErr) };
  return { data: { classroomId }, error: null };
}

async function mergeCoursePackageIntoClassroomTs(params: {
  classroomId: string;
  pkg: PerleapCoursePackageV2;
  updateClassroomFromPackage?: boolean;
  restrictToTeacherId?: string;
}): Promise<{ data: { classroomId: string } | null; error: ApiError | null }> {
  const atomic = false;
  const { classroomId, pkg, updateClassroomFromPackage, restrictToTeacherId } = params;
  const insertedSectionIdByLocalId = new Map<string, string>();

  try {
    if ((pkg.exported_from_classroom_id ?? '').trim() !== classroomId) {
      return {
        data: null,
        error: mergeFail(
          {
            message:
              'This file was exported from another class. Create a new class from backup, or use merge only when the file matches this class.',
          },
          { phase: 'exported_from_guard' },
          atomic,
        ),
      };
    }

    const { data: classroomRow, error: cErr } = await getClassroomById(classroomId, restrictToTeacherId);
    if (cErr) return { data: null, error: mergeFail(cErr, { phase: 'classroom_patch' }, atomic) };
    if (!classroomRow) return { data: null, error: mergeFail('Classroom not found', { phase: 'classroom_patch' }, atomic) };

    void classroomRow;

    if (updateClassroomFromPackage) {
      const { error: upErr } = await updateClassroom(
        classroomId,
        packageClassroomToUpdateMerge(pkg.course.classroom),
      );
      if (upErr) return { data: null, error: mergeFail(upErr, { phase: 'classroom_patch' }, atomic) };
    }

    const { data: liveSyllabus, error: syllErr } = await getSyllabusByClassroom(classroomId);
    if (syllErr) return { data: null, error: mergeFail(syllErr, { phase: 'syllabus_fetch' }, atomic) };

    const snap = pkg.course;

    if (snap.syllabus) {
      if (!liveSyllabus) {
        return {
          data: null,
          error: mergeFail('This classroom has no syllabus to merge into.', { phase: 'syllabus_mismatch' }, atomic),
        };
      }
      if (liveSyllabus.id !== snap.syllabus.id) {
        return {
          data: null,
          error: mergeFail(
            'Syllabus in this snapshot does not match the active syllabus id for this classroom.',
            {
              phase: 'syllabus_mismatch',
              entityId: snap.syllabus.id,
              humanLabel: snap.syllabus.title,
            },
            atomic,
          ),
        };
      }

      const s = snap.syllabus;
      const syId = liveSyllabus.id;

      const { error: syUpErr } = await updateSyllabus(syId, {
        title: s.title,
        summary: s.summary ?? undefined,
        structure_type: s.structure_type as SyllabusStructureType,
        status: s.status as Syllabus['status'],
        release_mode: normalizeReleaseMode(s.release_mode as Syllabus['release_mode']),
        published_at: s.published_at ?? undefined,
        accent_color: s.accent_color ?? undefined,
        banner_url: s.banner_url ?? undefined,
        section_label_override: s.section_label_override ?? undefined,
        custom_settings: (s.custom_settings ?? {}) as Syllabus['custom_settings'],
      });
      if (syUpErr) return { data: null, error: mergeFail(syUpErr, { phase: 'syllabus_patch', entityId: syId }, atomic) };

      for (let gi = 0; gi < s.grading_categories.length; gi++) {
        const gc = s.grading_categories[gi];
        const { data: gcRowSame } = await supabase
          .from('grading_categories')
          .select('id')
          .eq('id', gc.id)
          .eq('syllabus_id', syId)
          .maybeSingle();
        if (gcRowSame) {
          const { error: cgUp } = await supabase
            .from('grading_categories')
            .update({ name: gc.name, weight: gc.weight })
            .eq('id', gc.id);
          if (cgUp)
            return {
              data: null,
              error: mergeFail(handleSupabaseError(cgUp), {
                phase: 'grading_categories',
                indexInPkg: gi,
                entity: 'grading_category',
                entityId: gc.id,
                humanLabel: gc.name,
              }, atomic),
            };
        } else {
          const { data: gcConflict } = await supabase
            .from('grading_categories')
            .select('id, syllabus_id')
            .eq('id', gc.id)
            .maybeSingle();
          const rowCf = gcConflict as { syllabus_id?: string } | null;
          if (rowCf?.syllabus_id && rowCf.syllabus_id !== syId) {
            return {
              data: null,
              error: mergeFail('Grading category id belongs to a different syllabus; refusing merge.', {
                phase: 'grading_categories',
                indexInPkg: gi,
                entity: 'grading_category',
                entityId: gc.id,
                humanLabel: gc.name,
              }, atomic),
            };
          }
          const { error: insCg } = await supabase.from('grading_categories').insert({
            id: gc.id,
            syllabus_id: syId,
            name: gc.name,
            weight: gc.weight,
          });
          if (insCg)
            return {
              data: null,
              error: mergeFail(handleSupabaseError(insCg), {
                phase: 'grading_categories',
                indexInPkg: gi,
                entity: 'grading_category',
                entityId: gc.id,
                humanLabel: gc.name,
              }, atomic),
            };
        }
      }

      const sectionsSorted = sortSectionsCourse(snap);

      /* Pass 1 — existing sections */
      for (let si = 0; si < sectionsSorted.length; si++) {
        const sec = sectionsSorted[si];
        const rawId = typeof sec.id === 'string' ? sec.id.trim() : '';
        if (!rawId || !isUuid(rawId)) continue;

        const chk = await assertSectionBelongs(sec.id!, syId);
        if (chk)
          return {
            data: null,
            error: mergeFail(chk, {
              phase: 'sections',
              indexInPkg: si,
              entity: 'section',
              entityId: sec.id,
              humanLabel: sectionHumanLabel(sec, si),
            }, atomic),
          };

        const { error: secErr } = await updateSyllabusSection(sec.id!, {
          title: sec.title,
          description: sec.description ?? undefined,
          content: sec.content ?? undefined,
          order_index: sec.order_index,
          start_date: sec.start_date ?? undefined,
          end_date: sec.end_date ?? undefined,
          objectives: sec.objectives ?? undefined,
          resources: sec.resources ?? undefined,
          notes: sec.notes ?? undefined,
          completion_status:
            sec.completion_status as Parameters<typeof updateSyllabusSection>[1]['completion_status'],
          is_locked: sec.is_locked,
        });
        if (secErr)
          return {
            data: null,
            error: mergeFail(secErr, {
              phase: 'sections',
              indexInPkg: si,
              entity: 'section',
              entityId: sec.id,
              humanLabel: sectionHumanLabel(sec, si),
            }, atomic),
          };
      }

      /* Pass 2 — new sections (no uuid id) */
      for (let si = 0; si < sectionsSorted.length; si++) {
        const sec = sectionsSorted[si];
        const rawId = typeof sec.id === 'string' ? sec.id.trim() : '';
        if (rawId && isUuid(rawId)) continue;

        const lk = typeof sec.local_id === 'string' ? sec.local_id.trim() : '';
        if (!lk) {
          return {
            data: null,
            error: mergeFail('Section missing id must include local_id.', {
              phase: 'sections',
              indexInPkg: si,
              entity: 'section',
              humanLabel: sectionHumanLabel(sec, si),
            }, atomic),
          };
        }

        const ins: CreateSyllabusSectionInput = {
          syllabus_id: syId,
          title: sec.title,
          description: sec.description,
          content: sec.content,
          order_index: sec.order_index,
          start_date: sec.start_date,
          end_date: sec.end_date,
          objectives: (sec.objectives ?? []).filter((o) => o.trim()),
          resources: sec.resources,
          notes: sec.notes,
          completion_status: sec.completion_status as CreateSyllabusSectionInput['completion_status'],
          prerequisites: [],
          is_locked: sec.is_locked,
        };

        const { data: created, error: creErr } = await createSyllabusSection(ins);
        if (creErr || !created?.id)
          return {
            data: null,
            error: mergeFail(creErr ?? { message: 'Failed to insert syllabus section' }, {
              phase: 'sections',
              indexInPkg: si,
              entity: 'section',
              humanLabel: sectionHumanLabel(sec, si),
            }, atomic),
          };
        insertedSectionIdByLocalId.set(lk, created.id);
      }

      /* Activities */
      for (let si = 0; si < sectionsSorted.length; si++) {
        const sec = sectionsSorted[si];
        const secDb = resolveSectionDbId(sec, insertedSectionIdByLocalId);
        if (!secDb) {
          return {
            data: null,
            error: mergeFail('Could not resolve section id for activity merge.', {
              phase: 'activities',
              indexInPkg: si,
              entity: 'section',
              entityId: sec.id,
              humanLabel: sectionHumanLabel(sec, si),
            }, atomic),
          };
        }

        const actsSorted = [...sec.activities].sort((a, b) => a.order_index - b.order_index);
        for (let ai = 0; ai < actsSorted.length; ai++) {
          const act = actsSorted[ai];
          const rawAid = typeof act.id === 'string' ? act.id.trim() : '';

          if (rawAid && isUuid(rawAid)) {
            const chkA = await assertActivityBelongsToSection(act.id!, secDb);
            if (chkA)
              return {
                data: null,
                error: mergeFail(chkA, {
                  phase: 'activities',
                  indexInPkg: si,
                  entity: 'activity',
                  entityId: act.id,
                  humanLabel: act.title,
                }, atomic),
              };
            /** Same columns as `merge_course_package_v2` activity UPDATE — do not PATCH denormalized file/url/text columns slim DB may omit (data lives in `lesson_content`). */
            const { error: ua } = await updateSectionResource(act.id!, {
              title: act.title,
              resource_type: act.resource_type as Parameters<typeof updateSectionResource>[1]['resource_type'],
              order_index: act.order_index,
              status: act.status as Parameters<typeof updateSectionResource>[1]['status'],
              lesson_content: (act.lesson_content as Json | null) ?? null,
            });
            if (ua)
              return {
                data: null,
                error: mergeFail(ua, {
                  phase: 'activities',
                  indexInPkg: si,
                  entity: 'activity',
                  entityId: act.id,
                  humanLabel: act.title,
                }, atomic),
              };
          } else {
            const { error: insA } = await createSectionResource({
              section_id: secDb,
              title: act.title,
              resource_type: act.resource_type as ResourceType,
              order_index: act.order_index,
              status: (act.status ?? 'published') as ActivityResourceStatus,
              lesson_content: (act.lesson_content as Json | null) ?? null,
              summary: act.summary ?? null,
              body_text: act.body_text ?? null,
              file_path: act.file_path,
              url: act.url,
              mime_type: act.mime_type,
              file_size: act.file_size,
              estimated_duration_minutes: act.estimated_duration_minutes,
            });
            if (insA)
              return {
                data: null,
                error: mergeFail(insA, {
                  phase: 'activities',
                  indexInPkg: si,
                  entity: 'activity',
                  humanLabel: act.title,
                }, atomic),
              };
          }
        }
      }

      /* Prerequisites */
      for (let si = 0; si < sectionsSorted.length; si++) {
        const sec = sectionsSorted[si];
        const secDb = resolveSectionDbId(sec, insertedSectionIdByLocalId);
        if (!secDb) continue;

        const prereqUuids: string[] = [];
        for (const p of sec.prerequisites_section_ids ?? []) {
          if (typeof p === 'string' && isUuid(p)) prereqUuids.push(p.trim());
        }
        for (const k of sec.prerequisites_merge_keys ?? []) {
          const kk = typeof k === 'string' ? k.trim() : '';
          if (!kk) continue;
          const dep = insertedSectionIdByLocalId.get(kk);
          if (!dep) {
            return {
              data: null,
              error: mergeFail(`Unknown prerequisite_merge_key: ${kk}`, {
                phase: 'section_prerequisites',
                indexInPkg: si,
                entity: 'section',
                entityId: typeof sec.id === 'string' ? sec.id : undefined,
                humanLabel: sectionHumanLabel(sec, si),
              }, atomic),
            };
          }
          prereqUuids.push(dep);
        }

        const { error: prErr } = await updateSyllabusSection(secDb, { prerequisites: prereqUuids });
        if (prErr)
          return {
            data: null,
            error: mergeFail(prErr, {
              phase: 'section_prerequisites',
              indexInPkg: si,
              entity: 'section',
              entityId: typeof sec.id === 'string' ? sec.id : secDb,
              humanLabel: sectionHumanLabel(sec, si),
            }, atomic),
          };
      }
    }

    for (let i = 0; i < snap.assignments.length; i++) {
      const a = snap.assignments[i];
      const v = await assertAssignmentBelongs(String(a.id), classroomId);
      if (v)
        return {
          data: null,
          error: mergeFail(v, {
            phase: 'assignments',
            indexInPkg: i,
            entity: 'assignment',
            entityId: String(a.id),
            humanLabel: a.title,
          }, atomic),
        };

      const syIdSnap = snap.syllabus?.id ?? null;
      let sectionResolved: string | null = null;

      const { error: ua } = await updateAssignment(String(a.id), {
        title: a.title,
        instructions: a.instructions,
        student_facing_task: a.student_facing_task,
        type: a.type,
        status: a.status,
        due_at: a.due_at,
        target_dimensions: a.target_dimensions as never,
        personalization_flag: a.personalization_flag,
        auto_publish_ai_feedback: a.auto_publish_ai_feedback,
        attempt_mode: a.attempt_mode as Parameters<typeof updateAssignment>[1]['attempt_mode'],
        materials: a.materials as Json | undefined,
        hard_skills: a.hard_skills,
        hard_skill_domain: a.hard_skill_domain ?? undefined,
      });
      if (ua)
        return {
          data: null,
          error: mergeFail(ua, {
            phase: 'assignments',
            indexInPkg: i,
            entity: 'assignment',
            entityId: String(a.id),
            humanLabel: a.title,
          }, atomic),
        };

      if (a.syllabus_section_ref) {
        if (!syIdSnap) {
          return {
            data: null,
            error: mergeFail('Assignment links to section but syllabus is missing in snapshot.', {
              phase: 'assignments',
              indexInPkg: i,
              entity: 'assignment',
              entityId: String(a.id),
              humanLabel: a.title,
            }, atomic),
          };
        }
        const chkS = await assertSectionBelongs(a.syllabus_section_ref, syIdSnap);
        if (chkS)
          return {
            data: null,
            error: mergeFail(chkS, {
              phase: 'assignments',
              indexInPkg: i,
              entity: 'assignment',
              entityId: String(a.id),
              humanLabel: a.title,
            }, atomic),
          };

        sectionResolved = a.syllabus_section_ref;

        let gcValidated: string | null = null;
        if (a.grading_category_ref) {
          const chkG = await assertGcBelongs(a.grading_category_ref, syIdSnap);
          if (chkG)
            return {
              data: null,
              error: mergeFail(chkG, {
                phase: 'assignments',
                indexInPkg: i,
                entity: 'assignment',
                entityId: String(a.id),
                humanLabel: a.title,
              }, atomic),
            };
          gcValidated = a.grading_category_ref;
        }

        const { error: lk } = await linkAssignmentToSection(String(a.id), a.syllabus_section_ref, gcValidated);
        if (lk)
          return {
            data: null,
            error: mergeFail(lk, {
              phase: 'assignments',
              indexInPkg: i,
              entity: 'assignment',
              entityId: String(a.id),
              humanLabel: a.title,
            }, atomic),
          };
      } else {
        if (a.grading_category_ref && syIdSnap) {
          const chkG = await assertGcBelongs(a.grading_category_ref, syIdSnap);
          if (chkG)
            return {
              data: null,
              error: mergeFail(chkG, {
                phase: 'assignments',
                indexInPkg: i,
                entity: 'assignment',
                entityId: String(a.id),
                humanLabel: a.title,
              }, atomic),
            };
          const { error: gb } = await supabase
            .from('assignments')
            .update({ grading_category_id: a.grading_category_ref })
            .eq('id', String(a.id));
          if (gb)
            return {
              data: null,
              error: mergeFail(handleSupabaseError(gb), {
                phase: 'assignments',
                indexInPkg: i,
                entity: 'assignment',
                entityId: String(a.id),
                humanLabel: a.title,
              }, atomic),
            };
        }
        const { error: unL } = await unlinkAssignmentFromSection(String(a.id));
        if (unL)
          return {
            data: null,
            error: mergeFail(unL, {
              phase: 'assignments',
              indexInPkg: i,
              entity: 'assignment',
              entityId: String(a.id),
              humanLabel: a.title,
            }, atomic),
          };
        const { error: clr } = await setAssignmentLinkedActivities(String(a.id), null, []);
        if (clr)
          return {
            data: null,
            error: mergeFail(clr, {
              phase: 'assignment_links',
              indexInPkg: i,
              entity: 'assignment',
              entityId: String(a.id),
              humanLabel: a.title,
            }, atomic),
          };
      }

      const links = snap.assignment_activity_links[i] ?? [];
      if (sectionResolved) {
        const inputs: AssignmentModuleActivityInput[] = links
          .filter((l) => l.activity_ref && String(l.activity_ref).includes('-'))
          .map((l) => ({
            activity_list_id: String(l.activity_ref),
            order_index: l.order_index,
            include_in_ai_context: l.include_in_ai_context,
          }));
        const { error: lj } = await setAssignmentLinkedActivities(String(a.id), sectionResolved, inputs);
        if (lj)
          return {
            data: null,
            error: mergeFail(lj, {
              phase: 'assignment_links',
              indexInPkg: i,
              entity: 'assignment',
              entityId: String(a.id),
              humanLabel: a.title,
            }, atomic),
          };
      }
    }

    const flows = snap.module_flow_by_section;
    if (snap.syllabus && flows && flows.length === snap.syllabus.sections.length) {
      const sectionsSorted = sortSectionsCourse(snap);
      for (let si = 0; si < sectionsSorted.length; si++) {
        const sec = sectionsSorted[si];
        const secDb = resolveSectionDbId(sec, insertedSectionIdByLocalId);
        if (!secDb) {
          return {
            data: null,
            error: mergeFail('Could not resolve section for module flow.', {
              phase: 'module_flow',
              indexInPkg: si,
              entity: 'section',
              humanLabel: sectionHumanLabel(sec, si),
            }, atomic),
          };
        }
        const rawSteps = flows[si] ?? [];
        const steps: FlowStepInput[] = rawSteps.map((st: CoursePackageModuleFlowStepV2, ord: number) => {
          if (st.step_kind === 'resource') {
            return {
              order_index: ord,
              step_kind: 'resource' as const,
              activity_list_id: st.activity_ref ?? null,
              assignment_id: null,
            };
          }
          return {
            order_index: ord,
            step_kind: 'assignment' as const,
            activity_list_id: null,
            assignment_id: st.assignment_ref ?? null,
          };
        });
        const { error: rf } = await replaceModuleFlowSteps(secDb, steps);
        if (rf)
          return {
            data: null,
            error: mergeFail(rf, {
              phase: 'module_flow',
              indexInPkg: si,
              entity: 'flow_step',
              entityId: secDb,
              humanLabel: sectionHumanLabel(sec, si),
            }, atomic),
          };
      }
    }

    return { data: { classroomId }, error: null };
  } catch (e) {
    return { data: null, error: mergeFail(handleSupabaseError(e), { phase: 'module_flow' }, atomic) };
  }
}

export async function mergeCoursePackageIntoClassroom(params: {
  classroomId: string;
  pkg: PerleapCoursePackageV2;
  updateClassroomFromPackage?: boolean;
  restrictToTeacherId?: string;
}): Promise<{ data: { classroomId: string } | null; error: ApiError | null }> {
  if (shouldUseCoursePackageMergeRpc() && !packageNeedsTypescriptCourseMerge(params.pkg)) {
    return mergeCoursePackageIntoClassroomRpc(params);
  }
  return mergeCoursePackageIntoClassroomTs(params);
}
