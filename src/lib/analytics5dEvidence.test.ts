import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_MAX_TOTAL_CHARS,
  hashEvidenceKey,
  parseScoreExplanations,
  trimToMax,
  _build5dNarrativeEvidenceImpl,
  type Build5dNarrativeEvidenceInput,
} from '@/lib/analytics5dEvidence';

const baseA = (id: string) => ({
  id,
  title: `T-${id.slice(0, 4)}`,
  syllabusSectionId: 'sec1' as const,
  instructions: 'x'.repeat(1200),
});

function minInput(
  overrides: Partial<Build5dNarrativeEvidenceInput> = {},
): Build5dNarrativeEvidenceInput {
  return {
    context: 'class_avg',
    allowedAssignmentIds: ['a1'],
    assignmentRefs: [baseA('a1')],
    allStudents: [
      {
        id: 's1',
        fullName: 'A',
        narrativeRows: [
          {
            studentId: 's1',
            studentName: 'A',
            assignmentId: 'a1',
            assignmentTitle: 'T',
            sectionTitle: 'M',
            syllabusSectionId: 'sec1',
            submissionId: 'sub1',
            studentFeedback: 'hello',
            scoreExplanations: { vision: 'v' },
          },
        ],
      },
    ],
    sectionTitleResolver: (sid) => (sid == null ? 'U' : 'M'),
    ...overrides,
  };
}

describe('parseScoreExplanations', () => {
  it('returns null for empty or non-object', () => {
    expect(parseScoreExplanations(null)).toBeNull();
    expect(parseScoreExplanations('x' as any)).toBeNull();
  });

  it('parses dimension strings', () => {
    const o = parseScoreExplanations({
      vision: 'a',
      values: 'b',
      thinking: ' ',
      connection: 1 as any,
    });
    expect(o).toEqual({ vision: 'a', values: 'b' });
  });
});

describe('trimToMax', () => {
  it('appends ellipsis when over max', () => {
    expect(trimToMax('abcde', 4).endsWith('…')).toBe(true);
  });
});

describe('hashEvidenceKey', () => {
  it('changes when text changes', () => {
    expect(hashEvidenceKey('a')).not.toBe(hashEvidenceKey('b'));
  });
});

describe('build5dNarrativeEvidence', () => {
  it('returns empty for no allowed ids', () => {
    const r = _build5dNarrativeEvidenceImpl(
      minInput({ allowedAssignmentIds: [], assignmentRefs: [] }),
    );
    expect(r.evidenceText).toBe('');
    expect(r.sourceCount).toBe(0);
  });

  it('respects total char cap', () => {
    const longFb = 'z'.repeat(EVIDENCE_MAX_TOTAL_CHARS);
    const r = _build5dNarrativeEvidenceImpl(
      minInput({
        allStudents: [
          {
            id: 's1',
            fullName: 'A',
            narrativeRows: [
              {
                studentId: 's1',
                studentName: 'A',
                assignmentId: 'a1',
                assignmentTitle: 'T',
                sectionTitle: 'M',
                syllabusSectionId: 'sec1',
                submissionId: 'sub1',
                studentFeedback: longFb,
                scoreExplanations: null,
              },
            ],
          },
        ],
      }),
    );
    expect(r.evidenceText.length).toBeLessThanOrEqual(EVIDENCE_MAX_TOTAL_CHARS);
  });

  it('stratifies by assignment in class_avg', () => {
    const r = _build5dNarrativeEvidenceImpl(
      minInput({
        context: 'class_avg',
        allowedAssignmentIds: ['a1', 'a2'],
        assignmentRefs: [baseA('a1'), { ...baseA('a2'), id: 'a2' }],
        allStudents: [
          {
            id: 's1',
            fullName: 'A',
            narrativeRows: [
              {
                studentId: 's1',
                studentName: 'A',
                assignmentId: 'a1',
                assignmentTitle: 'T1',
                sectionTitle: 'M',
                syllabusSectionId: 'sec1',
                submissionId: 'sub1',
                studentFeedback: 'fa',
                scoreExplanations: null,
              },
              {
                studentId: 's1',
                studentName: 'A',
                assignmentId: 'a2',
                assignmentTitle: 'T2',
                sectionTitle: 'M',
                syllabusSectionId: 'sec1',
                submissionId: 'sub2',
                studentFeedback: 'fb',
                scoreExplanations: null,
              },
            ],
          },
        ],
      }),
    );
    expect(r.evidenceText).toContain('fa');
    expect(r.evidenceText).toContain('fb');
  });

  it('treats all-null text as zero excerpt sources (header may still use assignments)', () => {
    const r = _build5dNarrativeEvidenceImpl(
      minInput({
        allStudents: [
          {
            id: 's1',
            fullName: 'A',
            narrativeRows: [
              {
                studentId: 's1',
                studentName: 'A',
                assignmentId: 'a1',
                assignmentTitle: 'T',
                sectionTitle: 'M',
                syllabusSectionId: 'sec1',
                submissionId: 'sub1',
                studentFeedback: null,
                scoreExplanations: null,
              },
            ],
          },
        ],
      }),
    );
    expect(r.sourceCount).toBe(0);
    expect(r.evidenceText).toContain('## Assignment context');
    expect(r.evidenceText).not.toContain('Student-facing feedback:');
  });

  it('round-robins so a high-volume assignment does not hide another assignment in class_avg', () => {
    const students = Array.from({ length: 13 }, (_, i) => {
      const n = (i + 1).toString();
      return {
        id: `s${n}`,
        fullName: `S${n}`,
        narrativeRows: [
          {
            studentId: `s${n}`,
            studentName: `S${n}`,
            assignmentId: 'a1',
            assignmentTitle: 'T1',
            sectionTitle: 'M',
            syllabusSectionId: 'sec1',
            submissionId: `sub-a1-${n}`,
            studentFeedback: `bulk-${n}`,
            scoreExplanations: null,
          },
        ],
      };
    });
    students.push({
      id: 's14',
      fullName: 'S14',
      narrativeRows: [
        {
          studentId: 's14',
          studentName: 'S14',
          assignmentId: 'a2',
          assignmentTitle: 'T2',
          sectionTitle: 'M',
          syllabusSectionId: 'sec1',
          submissionId: 'sub-a2-14',
          studentFeedback: 'only-in-second-assignment',
          scoreExplanations: null,
        },
      ],
    });

    const r = _build5dNarrativeEvidenceImpl(
      minInput({
        context: 'class_avg',
        allowedAssignmentIds: ['a1', 'a2'],
        assignmentRefs: [baseA('a1'), { ...baseA('a2'), id: 'a2' }],
        allStudents: students,
      }),
    );
    expect(r.evidenceText).toContain('only-in-second-assignment');
    expect(r.sourceCount).toBeGreaterThan(0);
  });

  it('module_compare with compareModuleId only includes rows for that section', () => {
    const r = _build5dNarrativeEvidenceImpl(
      minInput({
        context: 'module_compare',
        compareModuleId: 'sec1',
        allowedAssignmentIds: ['a1', 'a2'],
        assignmentRefs: [baseA('a1'), { ...baseA('a2'), id: 'a2', syllabusSectionId: 'sec2' as const }],
        allStudents: [
          {
            id: 's1',
            fullName: 'A',
            narrativeRows: [
              {
                studentId: 's1',
                studentName: 'A',
                assignmentId: 'a1',
                assignmentTitle: 'T1',
                sectionTitle: 'M1',
                syllabusSectionId: 'sec1',
                submissionId: 'sub1',
                studentFeedback: 'keep-sec1',
                scoreExplanations: null,
              },
              {
                studentId: 's1',
                studentName: 'A',
                assignmentId: 'a2',
                assignmentTitle: 'T2',
                sectionTitle: 'M2',
                syllabusSectionId: 'sec2',
                submissionId: 'sub2',
                studentFeedback: 'drop-sec2',
                scoreExplanations: null,
              },
            ],
          },
        ],
      }),
    );
    expect(r.evidenceText).toContain('keep-sec1');
    expect(r.evidenceText).not.toContain('drop-sec2');
  });

  it('includes capped teacher note when includeTeacherNotes is true', () => {
    const r = _build5dNarrativeEvidenceImpl(
      minInput({
        includeTeacherNotes: true,
        allStudents: [
          {
            id: 's1',
            fullName: 'A',
            narrativeRows: [
              {
                studentId: 's1',
                studentName: 'A',
                assignmentId: 'a1',
                assignmentTitle: 'T',
                sectionTitle: 'M',
                syllabusSectionId: 'sec1',
                submissionId: 'sub1',
                studentFeedback: null,
                teacherNote: 'Grading: solid structure.',
                scoreExplanations: null,
              },
            ],
          },
        ],
      }),
    );
    expect(r.sourceCount).toBe(1);
    expect(r.evidenceText).toContain('Teacher note:');
    expect(r.evidenceText).toContain('Grading:');
  });
});

/**
 * Release QA (teacher analytics, 5D): empty class with no written feedback; one student with rich
 * feedback; module-compare A vs B with different assignment counts; confirm scoresOnly vs
 * “based on” copy in `Analytics5dNarrativeBlocks`. Re-run when changing
 * `supabase/functions/explain-analytics-5d` or `analytics5dEvidence` capping; deploy the edge
 * function after function edits: `npx supabase functions deploy explain-analytics-5d`.
 */
