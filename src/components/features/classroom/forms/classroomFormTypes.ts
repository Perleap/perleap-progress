import type { CourseMaterial, Domain } from '@/types/models';

/** Shared shape for create-wizard step 1 and edit-classroom dialog */
export type ClassroomFormData = {
  courseTitle: string;
  startDate: string;
  endDate: string;
  courseDescription: string;
  learningOutcomes: string[];
  keyChallenges: string[];
  domains: Domain[];
  materials: CourseMaterial[];
};

export type EditClassroomFormData = ClassroomFormData;

export type EditClassroomRecord = {
  id: string;
  name: string;
  subject: string;
  course_title: string | null;
  start_date: string | null;
  end_date: string | null;
  resources: string | null;
  learning_outcomes: string[] | null;
  key_challenges: string[] | null;
  domains: Domain[] | null;
  materials: CourseMaterial[] | null;
};

export function buildEditClassroomFormData(classroom: EditClassroomRecord): ClassroomFormData {
  return {
    courseTitle: classroom.course_title || classroom.name || '',
    startDate: classroom.start_date || '',
    endDate: classroom.end_date || '',
    courseDescription: classroom.resources || '',
    learningOutcomes:
      classroom.learning_outcomes && classroom.learning_outcomes.length > 0
        ? classroom.learning_outcomes
        : ['', '', ''],
    keyChallenges:
      classroom.key_challenges && classroom.key_challenges.length > 0
        ? classroom.key_challenges
        : ['', ''],
    domains: (classroom.domains || []) as Domain[],
    materials: (classroom.materials || []) as CourseMaterial[],
  };
}

export function buildClassroomUpdatePayload(formData: ClassroomFormData) {
  const filteredDomains = formData.domains
    .filter((d) => d.name.trim())
    .map((d) => ({
      name: d.name,
      components: d.components.filter((c) => c.trim()),
    }))
    .filter((d) => d.components.length > 0);

  return {
    name: formData.courseTitle || 'New Classroom',
    subject: formData.courseTitle || 'General',
    course_title: formData.courseTitle,
    start_date: formData.startDate || null,
    end_date: formData.endDate || null,
    resources: formData.courseDescription || '',
    learning_outcomes: formData.learningOutcomes.filter((o) => o.trim()),
    key_challenges: formData.keyChallenges.filter((c) => c.trim()),
    domains: filteredDomains,
    materials: formData.materials,
  };
}

export type ClassroomFormSectionProps = {
  formData: ClassroomFormData;
  onFormChange: (partial: Partial<ClassroomFormData>) => void;
};
