/**
 * Build v1 course package JSON from live DB-shaped data (no I/O).
 */

import type { Json } from '@/integrations/supabase/types';
import type { Assignment } from '@/types/models';
import type {
  CoursePackageActivityV1,
  CoursePackageAssignmentActivityLinkV1,
  CoursePackageAssignmentV1,
  CoursePackageClassroomV1,
  CoursePackageCourseV1,
  CoursePackageGradingCategoryV1,
  CoursePackageModuleFlowStepV1,
  CoursePackagePolicyV1,
  CoursePackageSectionV1,
  CoursePackageSyllabusV1,
  PerleapCoursePackageV1,
  CoursePackageActivityV2,
  CoursePackageAssignmentActivityLinkV2,
  CoursePackageAssignmentV2,
  CoursePackageCourseV2,
  CoursePackageGradingCategoryV2,
  CoursePackageModuleFlowStepV2,
  CoursePackageSectionV2,
  CoursePackageSyllabusV2,
  PerleapCoursePackageV2,
} from '@/types/coursePackage';
import {
  COURSE_PACKAGE_FORMAT,
  COURSE_PACKAGE_VERSION,
  COURSE_PACKAGE_VERSION_V2,
} from '@/types/coursePackage';
import type {
  GradingCategory,
  ModuleFlowStep,
  SectionResource,
  SyllabusSection,
  SyllabusWithSections,
  AssignmentModuleActivity,
} from '@/types/syllabus';

export type BuildCoursePackageInput = {
  classroom: Record<string, unknown>;
  syllabus: SyllabusWithSections | null;
  assignments: Array<Record<string, unknown>>;
  moduleFlowSteps: ModuleFlowStep[];
  assignmentModuleActivitiesByAssignmentId: Record<string, AssignmentModuleActivity[]>;
  sourceClassroomName?: string | null;
};

function sectionLocalId(index: number): string {
  return `sec_${index}`;
}

function gradingLocalId(index: number): string {
  return `gc_${index}`;
}

function activityLocalId(sectionIndex: number, activityIndex: number): string {
  return `act_${sectionIndex}_${activityIndex}`;
}

function assignmentLocalId(index: number): string {
  return `asg_${index}`;
}

function toJsonArrayField(v: unknown): Json | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v as unknown as Json;
  return v as Json;
}

export function buildCoursePackageV1(input: BuildCoursePackageInput): PerleapCoursePackageV1 {
  const c = input.classroom;
  const learningOutcomes = c.learning_outcomes;
  const keyChallenges = c.key_challenges;

  const classroomPayload: CoursePackageClassroomV1 = {
    name: String(c.name ?? 'Course'),
    subject: c.subject != null ? String(c.subject) : null,
    goals: c.goals != null ? String(c.goals) : null,
    course_title: c.course_title != null ? String(c.course_title) : null,
    course_duration: c.course_duration != null ? String(c.course_duration) : null,
    start_date: c.start_date != null ? String(c.start_date) : null,
    end_date: c.end_date != null ? String(c.end_date) : null,
    course_outline: c.course_outline != null ? String(c.course_outline) : null,
    resources: c.resources != null ? String(c.resources) : null,
    learning_outcomes: toJsonArrayField(learningOutcomes),
    key_challenges: toJsonArrayField(keyChallenges),
    domains: (c.domains as Json | null) ?? null,
    materials: (c.materials as Json | null) ?? null,
  };

  const syllabusData = input.syllabus;
  let syllabusPayload: CoursePackageSyllabusV1 | null = null;

  const sectionUuidToLocal = new Map<string, string>();
  const activityUuidToLocal = new Map<string, string>();
  const gcUuidToLocal = new Map<string, string>();

  if (syllabusData) {
    const policies: CoursePackagePolicyV1[] = (syllabusData.policies ?? []).map((p, i) => ({
      type: p.type,
      label: p.label,
      content: p.content,
      order_index: p.order_index ?? i,
    }));

    const gradingSorted = [...(syllabusData.grading_categories ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const grading_categories: CoursePackageGradingCategoryV1[] = gradingSorted.map((g: GradingCategory, i) => {
      const lid = gradingLocalId(i);
      gcUuidToLocal.set(g.id, lid);
      return { local_id: lid, name: g.name, weight: g.weight };
    });

    const sectionsSorted = [...syllabusData.sections].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
    );

    sectionsSorted.forEach((s: SyllabusSection, si: number) => {
      sectionUuidToLocal.set(s.id, sectionLocalId(si));
    });

    const resourceMap = syllabusData.section_resources ?? {};
    const sections: CoursePackageSectionV1[] = sectionsSorted.map((s: SyllabusSection, si: number) => {
      const prereqLocal = (s.prerequisites ?? [])
        .map((pid) => sectionUuidToLocal.get(pid))
        .filter((x): x is string => Boolean(x));

      const rawActs = (resourceMap[String(s.id)] ?? []) as SectionResource[];
      const actsSorted = [...rawActs].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      const activities: CoursePackageActivityV1[] = actsSorted.map((r, ai) => {
        const lid = activityLocalId(si, ai);
        activityUuidToLocal.set(r.id, lid);
        const a: CoursePackageActivityV1 = {
          local_id: lid,
          resource_type: r.resource_type,
          title: r.title,
          order_index: r.order_index,
          status: (r.status as string) || 'published',
          lesson_content: (r.lesson_content as Json | null) ?? null,
          summary: r.summary ?? null,
          body_text: r.body_text ?? null,
          file_path: r.file_path ?? null,
          url: r.url ?? null,
          mime_type: r.mime_type ?? null,
          file_size: r.file_size ?? null,
          estimated_duration_minutes: r.estimated_duration_minutes ?? null,
        };
        return a;
      });

      const sec: CoursePackageSectionV1 = {
        local_id: sectionLocalId(si),
        title: s.title,
        description: s.description,
        content: s.content,
        order_index: s.order_index,
        start_date: s.start_date,
        end_date: s.end_date,
        objectives: s.objectives,
        resources: s.resources,
        notes: s.notes,
        completion_status: s.completion_status,
        prerequisites_local_ids: prereqLocal,
        is_locked: s.is_locked,
        activities,
      };
      return sec;
    });

    syllabusPayload = {
      title: syllabusData.title,
      summary: syllabusData.summary,
      structure_type: syllabusData.structure_type,
      policies,
      status: syllabusData.status,
      release_mode: syllabusData.release_mode,
      published_at: syllabusData.published_at,
      accent_color: syllabusData.accent_color,
      banner_url: syllabusData.banner_url,
      section_label_override: syllabusData.section_label_override,
      custom_settings:
        syllabusData.custom_settings && typeof syllabusData.custom_settings === 'object'
          ? syllabusData.custom_settings
          : {},
      grading_categories,
      sections,
    };
  }

  const roster = input.assignments
    .map((row) => {
      const { student_profiles: _sp, submissions: _sub, ...rest } = row as Record<string, unknown>;
      return rest;
    })
    .sort(
      (a, b) =>
        new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime(),
    );

  const assignmentUuidToLocal = new Map<string, string>();
  const exportAssignments: CoursePackageAssignmentV1[] = roster.map((row, i) => {
    const lid = assignmentLocalId(i);
    const id = String((row as { id: string }).id);
    assignmentUuidToLocal.set(id, lid);

    const a = row as unknown as Assignment & {
      syllabus_section_id?: string | null;
      grading_category_id?: string | null;
      target_dimensions?: unknown;
      materials?: unknown;
    };

    const sectionRef = a.syllabus_section_id
      ? sectionUuidToLocal.get(a.syllabus_section_id) ?? null
      : null;
    const gcRef = a.grading_category_id ? gcUuidToLocal.get(a.grading_category_id) ?? null : null;

    return {
      local_id: lid,
      syllabus_section_ref: sectionRef,
      grading_category_ref: gcRef,
      title: a.title,
      instructions: a.instructions,
      student_facing_task: a.student_facing_task ?? null,
      type: a.type,
      status: a.status,
      due_at: a.due_at,
      target_dimensions: (a.target_dimensions as Json) ?? ({} as Json),
      personalization_flag: Boolean(a.personalization_flag),
      auto_publish_ai_feedback: a.auto_publish_ai_feedback !== false,
      attempt_mode: a.attempt_mode ?? null,
      materials: (a.materials as Json | null) ?? null,
      hard_skills:
        typeof a.hard_skills === 'string'
          ? a.hard_skills
          : a.hard_skills != null
            ? JSON.stringify(a.hard_skills)
            : null,
      hard_skill_domain: a.hard_skill_domain ?? null,
      assigned_student_id: null,
    };
  });

  const assignment_activity_links: CoursePackageAssignmentActivityLinkV1[][] = exportAssignments.map(
    (_, i) => {
      const aid = String((roster[i] as { id: string }).id);
      const links = input.assignmentModuleActivitiesByAssignmentId[aid] ?? [];
      const sorted = [...links].sort((x, y) => x.order_index - y.order_index);
      return sorted.map((l) => {
        const actRef = activityUuidToLocal.get(l.activity_list_id);
        return {
          activity_ref: actRef ?? `missing_${l.activity_list_id}`,
          order_index: l.order_index,
          include_in_ai_context: l.include_in_ai_context,
        };
      });
    },
  );

  let module_flow_by_section: CoursePackageModuleFlowStepV1[][] | null = null;
  if (syllabusData && sectionUuidToLocal.size > 0) {
    const stepsBySection = new Map<string, ModuleFlowStep[]>();
    for (const st of input.moduleFlowSteps) {
      const list = stepsBySection.get(st.section_id) ?? [];
      list.push(st);
      stepsBySection.set(st.section_id, list);
    }
    const sectionsOrder = [...syllabusData.sections].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
    );
    module_flow_by_section = sectionsOrder.map((sec) => {
      const steps = (stepsBySection.get(sec.id) ?? []).sort((a, b) => a.order_index - b.order_index);
      return steps.map((st, idx) => {
        const step: CoursePackageModuleFlowStepV1 = {
          order_index: idx,
          step_kind: st.step_kind,
          activity_ref:
            st.step_kind === 'resource' && st.activity_list_id
              ? activityUuidToLocal.get(st.activity_list_id) ?? null
              : null,
          assignment_ref:
            st.step_kind === 'assignment' && st.assignment_id
              ? assignmentUuidToLocal.get(st.assignment_id) ?? null
              : null,
        };
        return step;
      });
    });
  }

  const course: CoursePackageCourseV1 = {
    classroom: classroomPayload,
    syllabus: syllabusPayload,
    assignments: exportAssignments,
    assignment_activity_links,
    module_flow_by_section,
  };

  const pkg: PerleapCoursePackageV1 = {
    format: COURSE_PACKAGE_FORMAT,
    version: COURSE_PACKAGE_VERSION,
    exported_at: new Date().toISOString(),
    source_classroom_name: input.sourceClassroomName ?? (String(c.name ?? null) || null),
    course,
  };
  return pkg;
}

/**
 * Build v2 merge-safe package: real UUIDs for entities and cross-refs so import can PATCH in place.
 */
export function buildCoursePackageV2(input: BuildCoursePackageInput): PerleapCoursePackageV2 {
  const c = input.classroom;
  const classroomIdStr = typeof c.id === 'string' ? c.id : String((c.id as unknown as string | undefined) ?? '');
  const learningOutcomes = c.learning_outcomes;
  const keyChallenges = c.key_challenges;

  const classroomPayload: CoursePackageCourseV2['classroom'] = {
    id: classroomIdStr || undefined,
    name: String(c.name ?? 'Course'),
    subject: c.subject != null ? String(c.subject) : null,
    goals: c.goals != null ? String(c.goals) : null,
    course_title: c.course_title != null ? String(c.course_title) : null,
    course_duration: c.course_duration != null ? String(c.course_duration) : null,
    start_date: c.start_date != null ? String(c.start_date) : null,
    end_date: c.end_date != null ? String(c.end_date) : null,
    course_outline: c.course_outline != null ? String(c.course_outline) : null,
    resources: c.resources != null ? String(c.resources) : null,
    learning_outcomes: toJsonArrayField(learningOutcomes),
    key_challenges: toJsonArrayField(keyChallenges),
    domains: (c.domains as Json | null) ?? null,
    materials: (c.materials as Json | null) ?? null,
  };

  const syllabusData = input.syllabus;
  let syllabusPayload: CoursePackageSyllabusV2 | null = null;

  const sectionUuidSet = new Set<string>();

  if (syllabusData) {
    const policies: CoursePackagePolicyV1[] = (syllabusData.policies ?? []).map((p, i) => ({
      type: p.type,
      label: p.label,
      content: p.content,
      order_index: p.order_index ?? i,
    }));

    const gradingSorted = [...(syllabusData.grading_categories ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const grading_categories: CoursePackageGradingCategoryV2[] = gradingSorted.map((g: GradingCategory) => ({
      id: g.id,
      name: g.name,
      weight: g.weight,
    }));

    const sectionsSorted = [...syllabusData.sections].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
    );
    sectionsSorted.forEach((s) => sectionUuidSet.add(s.id));

    const resourceMap = syllabusData.section_resources ?? {};
    const sections: CoursePackageSectionV2[] = sectionsSorted.map((s: SyllabusSection, si: number) => {
      const prereqUuids = (s.prerequisites ?? []).filter((pid) => sectionUuidSet.has(pid));

      const rawActs = (resourceMap[String(s.id)] ?? []) as SectionResource[];
      const actsSorted = [...rawActs].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

      const activities: CoursePackageActivityV2[] = actsSorted.map((r, ai) => {
        const lid = activityLocalId(si, ai);
        const act: CoursePackageActivityV2 = {
          local_id: lid,
          id: r.id,
          resource_type: r.resource_type,
          title: r.title,
          order_index: r.order_index,
          status: (r.status as string) || 'published',
          lesson_content: (r.lesson_content as Json | null) ?? null,
          summary: r.summary ?? null,
          body_text: r.body_text ?? null,
          file_path: r.file_path ?? null,
          url: r.url ?? null,
          mime_type: r.mime_type ?? null,
          file_size: r.file_size ?? null,
          estimated_duration_minutes: r.estimated_duration_minutes ?? null,
        };
        return act;
      });

      const sec: CoursePackageSectionV2 = {
        local_id: sectionLocalId(si),
        id: s.id,
        title: s.title,
        description: s.description,
        content: s.content,
        order_index: s.order_index,
        start_date: s.start_date,
        end_date: s.end_date,
        objectives: s.objectives,
        resources: s.resources,
        notes: s.notes,
        completion_status: s.completion_status,
        prerequisites_section_ids: prereqUuids,
        is_locked: s.is_locked,
        activities,
      };
      return sec;
    });

    syllabusPayload = {
      id: syllabusData.id,
      title: syllabusData.title,
      summary: syllabusData.summary,
      structure_type: syllabusData.structure_type,
      policies,
      status: syllabusData.status,
      release_mode: syllabusData.release_mode,
      published_at: syllabusData.published_at,
      accent_color: syllabusData.accent_color,
      banner_url: syllabusData.banner_url,
      section_label_override: syllabusData.section_label_override,
      custom_settings:
        syllabusData.custom_settings && typeof syllabusData.custom_settings === 'object'
          ? syllabusData.custom_settings
          : {},
      grading_categories,
      sections,
    };
  }

  const roster = input.assignments
    .map((row) => {
      const { student_profiles: _sp, submissions: _sub, ...rest } = row as Record<string, unknown>;
      return rest;
    })
    .sort(
      (a, b) =>
        new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime(),
    );

  const exportAssignments: CoursePackageAssignmentV2[] = roster.map((row, i) => {
    const lid = assignmentLocalId(i);
    const idStr = String((row as { id: string }).id);

    const a = row as unknown as Assignment & {
      syllabus_section_id?: string | null;
      grading_category_id?: string | null;
      target_dimensions?: unknown;
      materials?: unknown;
    };

    const sectionUuid = a.syllabus_section_id ?? null;
    const gcUuid = a.grading_category_id ?? null;

    const base: CoursePackageAssignmentV2 = {
      id: idStr,
      local_id: lid,
      syllabus_section_ref: sectionUuid,
      grading_category_ref: gcUuid,
      title: a.title,
      instructions: a.instructions,
      student_facing_task: a.student_facing_task ?? null,
      type: a.type,
      status: a.status,
      due_at: a.due_at,
      target_dimensions: (a.target_dimensions as Json) ?? ({} as Json),
      personalization_flag: Boolean(a.personalization_flag),
      auto_publish_ai_feedback: a.auto_publish_ai_feedback !== false,
      attempt_mode: a.attempt_mode ?? null,
      materials: (a.materials as Json | null) ?? null,
      hard_skills:
        typeof a.hard_skills === 'string'
          ? a.hard_skills
          : a.hard_skills != null
            ? JSON.stringify(a.hard_skills)
            : null,
      hard_skill_domain: a.hard_skill_domain ?? null,
      assigned_student_id: null,
    };
    return base;
  });

  const assignment_activity_links: CoursePackageAssignmentActivityLinkV2[][] = exportAssignments.map(
    (_, i) => {
      const aid = String((roster[i] as { id: string }).id);
      const links = input.assignmentModuleActivitiesByAssignmentId[aid] ?? [];
      const sorted = [...links].sort((x, y) => x.order_index - y.order_index);
      return sorted.map((l) => ({
        activity_ref: l.activity_list_id,
        order_index: l.order_index,
        include_in_ai_context: l.include_in_ai_context,
      }));
    },
  );

  let module_flow_by_section: CoursePackageModuleFlowStepV2[][] | null = null;
  if (syllabusPayload && sectionUuidSet.size > 0) {
    const stepsBySection = new Map<string, ModuleFlowStep[]>();
    for (const st of input.moduleFlowSteps) {
      const list = stepsBySection.get(st.section_id) ?? [];
      list.push(st);
      stepsBySection.set(st.section_id, list);
    }
    const sectionsOrder = [...syllabusPayload.sections].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
    );
    module_flow_by_section = sectionsOrder.map((sec) => {
      const steps = (stepsBySection.get(sec.id) ?? []).sort((a, b) => a.order_index - b.order_index);
      return steps.map((st, idx) => {
        const step: CoursePackageModuleFlowStepV2 = {
          order_index: idx,
          step_kind: st.step_kind,
          activity_ref:
            st.step_kind === 'resource' && st.activity_list_id ? st.activity_list_id : null,
          assignment_ref: st.step_kind === 'assignment' && st.assignment_id ? st.assignment_id : null,
        };
        return step;
      });
    });
  }

  const course: CoursePackageCourseV2 = {
    classroom: classroomPayload,
    syllabus: syllabusPayload,
    assignments: exportAssignments,
    assignment_activity_links,
    module_flow_by_section,
  };

  const pkg: PerleapCoursePackageV2 = {
    format: COURSE_PACKAGE_FORMAT,
    version: COURSE_PACKAGE_VERSION_V2,
    exported_at: new Date().toISOString(),
    source_classroom_name: input.sourceClassroomName ?? (String(c.name ?? null) || null),
    exported_from_classroom_id: classroomIdStr,
    course,
  };
  return pkg;
}
