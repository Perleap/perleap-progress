import { describe, it, expect } from 'vitest';
import {
  buildCohortOutcome,
  buildParticipantRow,
  buildRoleFitDistributionLine,
  completionRatio,
  computeEffectiveRankScore,
  computeWeightedScore,
  countCompletedAssignmentsInScope,
  countNotAssessed,
  fillRecommendationFallback,
  formatCompletionPercent,
  rankParticipantsForAppendix,
  sortParticipantsForDecision,
} from './buildPilotReportData';
import { buildPilotReportId } from './pilotReportId';
import { assessedParticipant, failedParticipant, testStaticCopy } from './testFixtures';
import type { PilotDimensionScores } from './types';

describe('countCompletedAssignmentsInScope', () => {
  const submissions = [
    { student_id: 's1', assignment_id: 'a1', status: 'completed' },
    { student_id: 's1', assignment_id: 'a1', status: 'completed' }, // duplicate attempt
    { student_id: 's1', assignment_id: 'a2', status: 'in_progress' },
    { student_id: 's1', assignment_id: 'a3', status: 'completed' }, // out of scope
    { student_id: 's2', assignment_id: 'a2', status: 'completed' }, // other student
  ];

  it('counts unique completed assignments within scope only', () => {
    expect(countCompletedAssignmentsInScope('s1', submissions, ['a1', 'a2'])).toBe(1);
  });

  it('returns 0 for empty scope', () => {
    expect(countCompletedAssignmentsInScope('s1', submissions, [])).toBe(0);
  });
});

describe('computeWeightedScore', () => {
  it('applies the 30/25/20/15/10 weights', () => {
    const dims: PilotDimensionScores = {
      builderExecution: 100,
      platformFit: 0,
      debuggingIndependence: 0,
      conceptualFluency: 0,
      communication: 0,
    };
    expect(computeWeightedScore(dims)).toBe(30);
  });

  it('returns 100 when all dimensions are 100', () => {
    const dims: PilotDimensionScores = {
      builderExecution: 100,
      platformFit: 100,
      debuggingIndependence: 100,
      conceptualFluency: 100,
      communication: 100,
    };
    expect(computeWeightedScore(dims)).toBe(100);
  });

  it('matches manual math on mixed scores', () => {
    const dims: PilotDimensionScores = {
      builderExecution: 80,
      platformFit: 75,
      debuggingIndependence: 60,
      conceptualFluency: 70,
      communication: 85,
    };
    // 24 + 18.75 + 12 + 10.5 + 8.5 = 73.75 → 74
    expect(computeWeightedScore(dims)).toBe(74);
  });
});

describe('buildParticipantRow', () => {
  it('builds an assessed row with weighted score', () => {
    const row = buildParticipantRow({
      id: 's1',
      name: 'Dana',
      completedInScope: 5,
      assignmentsInScope: 6,
      assessment: {
        dimensions: assessedParticipant.dimensions!,
        readiness: 'ready',
        roleFit: 'builder',
        keyStrength: 'Strong builds.',
        mainRisk: 'Debugging.',
        nextAction: 'Supervised work.',
        confidence: 'high',
        placementPriority: 9,
        whyBullets: ['Evidence bullet one.'],
      },
    });
    expect(row.assessed).toBe(true);
    expect(row.weightedScore).toBe(74);
    expect(row.placementPriority).toBe(9);
    expect(row.readiness).toBe('ready');
  });

  it('builds a not-assessed row on null assessment', () => {
    const row = buildParticipantRow({
      id: 's2',
      name: 'Noa',
      completedInScope: 1,
      assignmentsInScope: 6,
      assessment: null,
    });
    expect(row.assessed).toBe(false);
    expect(row.readiness).toBeNull();
    expect(row.weightedScore).toBeNull();
    expect(row.placementPriority).toBeNull();
  });
});

describe('buildCohortOutcome', () => {
  it('counts readiness labels over assessed participants only', () => {
    const cohort = buildCohortOutcome([assessedParticipant, failedParticipant]);
    expect(cohort.participantsAssessed).toBe(1);
    expect(cohort.participantsTotal).toBe(2);
    expect(cohort.readinessCounts.ready).toBe(1);
    expect(cohort.readinessCounts.coach).toBe(0);
    expect(cohort.roleFitCounts.builder).toBe(1);
  });

  it('computes mean dimension scores over assessed participants', () => {
    const second = {
      ...assessedParticipant,
      id: 'student-3',
      readiness: 'coach' as const,
      dimensions: {
        builderExecution: 60,
        conceptualFluency: 50,
        platformFit: 55,
        debuggingIndependence: 40,
        communication: 65,
      },
    };
    const cohort = buildCohortOutcome([assessedParticipant, second]);
    expect(cohort.meanDimensions).toEqual({
      builderExecution: 70,
      conceptualFluency: 60,
      platformFit: 65,
      debuggingIndependence: 50,
      communication: 75,
    });
    expect(cohort.readinessCounts.ready).toBe(1);
    expect(cohort.readinessCounts.coach).toBe(1);
  });

  it('returns null meanDimensions when no participant was assessed', () => {
    const cohort = buildCohortOutcome([failedParticipant]);
    expect(cohort.participantsAssessed).toBe(0);
    expect(cohort.meanDimensions).toBeNull();
  });
});

describe('fillRecommendationFallback', () => {
  it('fills the count placeholders', () => {
    const out = fillRecommendationFallback(
      '{{ready}} ready, {{coachOrTraining}} need coaching/training, {{redirect}} redirect.',
      { ready: 3, coach: 2, redirect: 1, not_ready: 1 },
    );
    expect(out).toBe('3 ready, 3 need coaching/training, 1 redirect.');
  });
});

describe('sortParticipantsForDecision', () => {
  it('orders by readiness then name', () => {
    const coach = { ...assessedParticipant, id: 'c', name: 'Zara', readiness: 'coach' as const };
    const ready = { ...assessedParticipant, id: 'r', name: 'Amy', readiness: 'ready' as const };
    const sorted = sortParticipantsForDecision([coach, failedParticipant, ready]);
    expect(sorted.map((p) => p.name)).toEqual(['Amy', 'Zara', 'Noa Levi']);
  });
});

describe('computeEffectiveRankScore', () => {
  it('multiplies placementPriority by completion ratio', () => {
    expect(completionRatio(1, 6)).toBeCloseTo(1 / 6);
    expect(
      computeEffectiveRankScore({
        ...assessedParticipant,
        placementPriority: 7,
        completedInScope: 1,
        assignmentsInScope: 6,
      }),
    ).toBeCloseTo(7 / 6);
    expect(
      computeEffectiveRankScore({
        ...assessedParticipant,
        placementPriority: 6,
        completedInScope: 5,
        assignmentsInScope: 6,
      }),
    ).toBeCloseTo(5);
  });

  it('returns 0 when placementPriority is missing', () => {
    expect(
      computeEffectiveRankScore({ ...assessedParticipant, placementPriority: null }),
    ).toBe(0);
  });
});

describe('rankParticipantsForAppendix', () => {
  it('assigns rank 1 to the highest effective score and orders best first', () => {
    const top = { ...assessedParticipant, id: 'r', name: 'Amy', placementPriority: 9 };
    const lower = {
      ...assessedParticipant,
      id: 'c',
      name: 'Zara',
      readiness: 'coach' as const,
      placementPriority: 5,
    };
    const ranked = rankParticipantsForAppendix([lower, top]);
    expect(ranked.map((p) => p.name)).toEqual(['Amy', 'Zara']);
  });

  it('ranks higher completion above higher raw priority when effective score is lower', () => {
    const lowCompletion = {
      ...assessedParticipant,
      id: 'a',
      name: 'Leah Levy',
      placementPriority: 7,
      completedInScope: 1,
      assignmentsInScope: 6,
    };
    const highCompletion = {
      ...assessedParticipant,
      id: 'b',
      name: 'Dana Cohen',
      placementPriority: 6,
      completedInScope: 5,
      assignmentsInScope: 6,
    };
    const ranked = rankParticipantsForAppendix([lowCompletion, highCompletion]);
    expect(ranked.map((p) => p.name)).toEqual(['Dana Cohen', 'Leah Levy']);
    expect(ranked[0].rank).toBe(1);
  });

  it('breaks effective-score ties by raw placementPriority then readiness', () => {
    const lowerPriority = {
      ...assessedParticipant,
      id: 'a',
      name: 'Alex',
      readiness: 'ready' as const,
      placementPriority: 6,
      completedInScope: 3,
      assignmentsInScope: 6,
    };
    const higherPriority = {
      ...assessedParticipant,
      id: 'b',
      name: 'Blair',
      readiness: 'coach' as const,
      placementPriority: 9,
      completedInScope: 2,
      assignmentsInScope: 6,
    };
    const ranked = rankParticipantsForAppendix([lowerPriority, higherPriority]);
    expect(ranked.map((p) => p.name)).toEqual(['Blair', 'Alex']);
  });

  it('breaks ties on placementPriority by readiness when completion is equal', () => {
    const coach = {
      ...assessedParticipant,
      id: 'a',
      name: 'Alex',
      readiness: 'coach' as const,
      placementPriority: 7,
    };
    const ready = {
      ...assessedParticipant,
      id: 'b',
      name: 'Blair',
      readiness: 'ready' as const,
      placementPriority: 7,
    };
    const ranked = rankParticipantsForAppendix([coach, ready]);
    expect(ranked.map((p) => p.name)).toEqual(['Blair', 'Alex']);
  });

  it('excludes not-assessed participants from ranked appendix list', () => {
    const ranked = rankParticipantsForAppendix([assessedParticipant, failedParticipant]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].rank).toBe(1);
  });

  it('ranks participants with placementPriority above legacy rows missing the field', () => {
    const legacy = {
      ...assessedParticipant,
      id: 'a',
      name: 'Alex',
      readiness: 'ready' as const,
      placementPriority: null,
    };
    const scored = {
      ...assessedParticipant,
      id: 'b',
      name: 'Blair',
      readiness: 'coach' as const,
      placementPriority: 6,
    };
    const ranked = rankParticipantsForAppendix([legacy, scored]);
    expect(ranked.map((p) => p.name)).toEqual(['Blair', 'Alex']);
  });

  it('falls back to readiness then name among legacy rows without placementPriority', () => {
    const coach = {
      ...assessedParticipant,
      id: 'a',
      name: 'Zara',
      readiness: 'coach' as const,
      placementPriority: null,
    };
    const ready = {
      ...assessedParticipant,
      id: 'b',
      name: 'Amy',
      readiness: 'ready' as const,
      placementPriority: null,
    };
    const ranked = rankParticipantsForAppendix([coach, ready]);
    expect(ranked.map((p) => p.name)).toEqual(['Amy', 'Zara']);
  });
});

describe('formatCompletionPercent', () => {
  it('returns rounded percentage', () => {
    expect(formatCompletionPercent(5, 6)).toBe('83%');
    expect(formatCompletionPercent(6, 6)).toBe('100%');
  });

  it('returns em dash when total is zero', () => {
    expect(formatCompletionPercent(0, 0)).toBe('—');
  });
});

describe('buildRoleFitDistributionLine', () => {
  it('includes only non-zero role-fit counts', () => {
    const line = buildRoleFitDistributionLine(
      { builder: 2, analyst: 0, champion: 1, enablement: 0, training: 0 },
      testStaticCopy.roleFitLabels,
    );
    expect(line).toContain('Builder / implementer: 2');
    expect(line).toContain('Platform champion: 1');
    expect(line).not.toContain('Solution analyst');
  });
});

describe('countNotAssessed', () => {
  it('counts failed rows', () => {
    expect(countNotAssessed([assessedParticipant, failedParticipant])).toBe(1);
  });
});

describe('buildPilotReportId', () => {
  it('uses PR prefix and course slug', () => {
    const id = buildPilotReportId('INSAIT Builders Pilot');
    expect(id).toMatch(/^PR-insait-builders-pilot-\d{8}-[A-Z0-9]{4}$/);
  });
});
