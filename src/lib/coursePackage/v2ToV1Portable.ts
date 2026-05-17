/**
 * Converts a merge-safe v2 package into portable v1 for create-classroom / full apply flows.
 */

import type {
  PerleapCoursePackageV1,
  PerleapCoursePackageV2,
  CoursePackageAssignmentActivityLinkV1,
  CoursePackageAssignmentV1,
  CoursePackageCourseV1,
  CoursePackageModuleFlowStepV1,
  CoursePackageSectionV1,
  CoursePackageSyllabusV1,
} from '@/types/coursePackage';
import { COURSE_PACKAGE_FORMAT, COURSE_PACKAGE_VERSION } from '@/types/coursePackage';

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

export function coursePackageV2ToV1Portable(pkg: PerleapCoursePackageV2): PerleapCoursePackageV1 {
  const cc = pkg.course.classroom;
  const { id: _classroomUuid, ...classroomSansId } = cc;

  let syllabusPayload: CoursePackageSyllabusV1 | null = null;
  const sectionUuidToLocal = new Map<string, string>();
  const fileLocalToV1SectionLocal = new Map<string, string>();
  const activityUuidToLocal = new Map<string, string>();
  const gcUuidToLocal = new Map<string, string>();

  const syl = pkg.course.syllabus;
  if (syl) {
    const grading_sorted = [...syl.grading_categories];
    grading_sorted.forEach((g, i) => {
      const lid = gradingLocalId(i);
      gcUuidToLocal.set(g.id, lid);
    });

    const sectionsSorted = [...syl.sections].sort(
      (a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title),
    );
    sectionsSorted.forEach((sec, si) => {
      const v1Local = sectionLocalId(si);
      const fileLid = typeof sec.local_id === 'string' ? sec.local_id.trim() : '';
      if (fileLid) fileLocalToV1SectionLocal.set(fileLid, v1Local);
      const sid = typeof sec.id === 'string' ? sec.id.trim() : '';
      if (sid) sectionUuidToLocal.set(sid, v1Local);
    });

    const grading_categories = grading_sorted.map((g, i) => ({
      local_id: gradingLocalId(i),
      name: g.name,
      weight: g.weight,
    }));

    const sections: CoursePackageSectionV1[] = sectionsSorted.map((s, si) => {
      const fromUuids = (s.prerequisites_section_ids ?? [])
        .map((pid) => sectionUuidToLocal.get(pid))
        .filter((x): x is string => Boolean(x));
      const fromKeys = (s.prerequisites_merge_keys ?? [])
        .map((k) => fileLocalToV1SectionLocal.get(String(k).trim()))
        .filter((x): x is string => Boolean(x));
      const prereqLocal = [...new Set([...fromUuids, ...fromKeys])];

      const activities_sorted = [...s.activities].sort(
        (a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title),
      );
      const activities = activities_sorted.map((r, ai) => {
        const lid = activityLocalId(si, ai);
        const aid = typeof r.id === 'string' ? r.id.trim() : '';
        if (aid) activityUuidToLocal.set(aid, lid);
        return {
          local_id: lid,
          resource_type: r.resource_type,
          title: r.title,
          order_index: r.order_index,
          status: r.status,
          lesson_content: r.lesson_content,
          summary: r.summary,
          body_text: r.body_text,
          file_path: r.file_path,
          url: r.url,
          mime_type: r.mime_type,
          file_size: r.file_size,
          estimated_duration_minutes: r.estimated_duration_minutes,
        };
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
      title: syl.title,
      summary: syl.summary,
      structure_type: syl.structure_type,
      policies: syl.policies,
      status: syl.status,
      release_mode: syl.release_mode,
      published_at: syl.published_at,
      accent_color: syl.accent_color,
      banner_url: syl.banner_url,
      section_label_override: syl.section_label_override,
      custom_settings: syl.custom_settings,
      grading_categories,
      sections,
    };
  }

  const assignmentUuidToLocal = new Map<string, string>();
  const roster = pkg.course.assignments;

  const exportAssignments: CoursePackageAssignmentV1[] = roster.map((a, i) => {
    const lid =
      typeof a.local_id === 'string' && a.local_id.trim()
        ? a.local_id
        : assignmentLocalId(i);
    if (a.id !== undefined && a.id !== null && String(a.id).trim())
      assignmentUuidToLocal.set(String(a.id), lid);

    const sectionRef =
      a.syllabus_section_ref != null ? sectionUuidToLocal.get(a.syllabus_section_ref) ?? null : null;
    const gcRef =
      a.grading_category_ref != null ? gcUuidToLocal.get(a.grading_category_ref) ?? null : null;

    return {
      local_id: lid,
      syllabus_section_ref: sectionRef,
      grading_category_ref: gcRef,
      title: a.title,
      instructions: a.instructions,
      student_facing_task: a.student_facing_task,
      type: a.type,
      status: a.status,
      due_at: a.due_at,
      target_dimensions: a.target_dimensions,
      personalization_flag: a.personalization_flag,
      auto_publish_ai_feedback: a.auto_publish_ai_feedback,
      attempt_mode: a.attempt_mode,
      materials: a.materials,
      hard_skills: a.hard_skills,
      hard_skill_domain: a.hard_skill_domain,
      assigned_student_id: a.assigned_student_id,
    };
  });

  const assignment_activity_links: CoursePackageAssignmentActivityLinkV1[][] = exportAssignments.map(
    (_, i) => {
      const origLinks = pkg.course.assignment_activity_links[i] ?? [];
      return origLinks.map((l) => ({
        activity_ref: activityUuidToLocal.get(String(l.activity_ref)) ?? String(l.activity_ref),
        order_index: l.order_index,
        include_in_ai_context: l.include_in_ai_context,
      }));
    },
  );

  let module_flow_by_section: CoursePackageModuleFlowStepV1[][] | null = null;
  const flows = pkg.course.module_flow_by_section;
  if (syl && flows && flows.length === syl.sections.length) {
    const sectionsSorted = [...syl.sections].sort(
      (a, b) => a.order_index - b.order_index || a.title.localeCompare(b.title),
    );
    module_flow_by_section = sectionsSorted.map((_sec, si) => {
      const rawSteps = flows[si] ?? [];
      return rawSteps.map((st, ord) => {
        const step: CoursePackageModuleFlowStepV1 = {
          order_index: ord,
          step_kind: st.step_kind,
          activity_ref:
            st.activity_ref != null ? activityUuidToLocal.get(st.activity_ref) ?? null : null,
          assignment_ref:
            st.assignment_ref != null ? assignmentUuidToLocal.get(st.assignment_ref) ?? null : null,
        };
        return step;
      });
    });
  }

  const course: CoursePackageCourseV1 = {
    classroom: classroomSansId,
    syllabus: syllabusPayload,
    assignments: exportAssignments,
    assignment_activity_links,
    module_flow_by_section,
  };

  return {
    format: COURSE_PACKAGE_FORMAT,
    version: COURSE_PACKAGE_VERSION,
    exported_at: pkg.exported_at,
    source_classroom_name: pkg.source_classroom_name ?? null,
    course,
  };
}
