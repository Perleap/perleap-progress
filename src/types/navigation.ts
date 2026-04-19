/** Passed on `<Link>` to `/classroom/:id/activity/:resourceId` so Back can restore the sidebar tab. */
export type ActivityLinkState = {
  /** Student: `curriculum`; teacher: `curriculum` when returning from an activity. */
  returnClassroomSection?: string;
};

/** Passed when navigating to `/classroom/:id` to open a specific tab. */
export type ClassroomLocationState = {
  /** Student: `overview` | `outline` | `curriculum`; teacher: includes `curriculum`, etc. */
  activeSection?: string;
  /** When opening the Submissions tab, pre-filter to this assignment. */
  submissionsAssignmentId?: string;
};
