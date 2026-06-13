import { describe, it, expect } from 'vitest';
import {
  buildCohortOutcome,
  buildParticipantRow,
  buildRoleFitDistributionLine,
  computeWeightedScore,
  countCompletedAssignmentsInScope,
  countNotAssessed,
  fillRecommendationFallback,
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
        whyBullets: ['Evidence bullet one.'],
      },
    });
    expect(row.assessed).toBe(true);
    expect(row.weightedScore).toBe(74);
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
