import { describe, expect, it } from 'vitest';
import {
  getAllowedAssignmentIds,
  getClassroomAverage5D,
  type AnalyticsAssignmentRef,
} from './analyticsScope';

const sampleAssignments: AnalyticsAssignmentRef[] = [
  { id: 'a1', title: 'A1', syllabusSectionId: 'm1' },
  { id: 'a2', title: 'A2', syllabusSectionId: 'm1' },
  { id: 'u1', title: 'U1', syllabusSectionId: null },
];

describe('getAllowedAssignmentIds', () => {
  it('returns all ids when both filters are all', () => {
    expect(
      getAllowedAssignmentIds(sampleAssignments, 'all', 'all').sort(),
    ).toEqual(['a1', 'a2', 'u1'].sort());
  });
  it('returns section subset', () => {
    expect(
      getAllowedAssignmentIds(sampleAssignments, 'm1', 'all').sort(),
    ).toEqual(['a1', 'a2'].sort());
  });
  it('returns unplaced', () => {
    expect(getAllowedAssignmentIds(sampleAssignments, 'unplaced', 'all')).toEqual(['u1']);
  });
  it('intersects single assignment with module', () => {
    expect(getAllowedAssignmentIds(sampleAssignments, 'm1', 'a1')).toEqual(['a1']);
  });
  it('rejects single assignment if not in module', () => {
    expect(getAllowedAssignmentIds(sampleAssignments, 'm1', 'u1')).toEqual([]);
  });
});

describe('getClassroomAverage5D', () => {
  it('returns null for empty allowed set', () => {
    const result = getClassroomAverage5D(
      [],
      [],
      sampleAssignments,
      'm1',
      'missing',
      'all',
      [],
    );
    expect(result).toBeNull();
  });
});
