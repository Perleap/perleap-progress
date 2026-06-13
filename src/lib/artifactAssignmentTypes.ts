/** Assignment types where the student submits an artifact (file, video, pipeline). */
export const ARTIFACT_ASSIGNMENT_TYPES = ['project', 'presentation', 'langchain'] as const;

export type ArtifactAssignmentType = (typeof ARTIFACT_ASSIGNMENT_TYPES)[number];

export function isArtifactAssignmentType(type: string | undefined | null): boolean {
  return ARTIFACT_ASSIGNMENT_TYPES.includes(type as ArtifactAssignmentType);
}

/** Artifact types default to teacher-gated feedback release. */
export function defaultAutoPublishForAssignmentType(type: string): boolean {
  return !isArtifactAssignmentType(type);
}
