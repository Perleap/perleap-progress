import { describe, expect, it } from 'vitest';
import {
  averageQedMeasuresAcrossSnapshots,
  hasDualLayerQedData,
  parseQedMeasures,
  qedMeasureToChartValue,
} from './qedMeasures';

describe('qedMeasures', () => {
  it('parseQedMeasures reads structured dimension data', () => {
    const parsed = parseQedMeasures({
      vision: { development: 72, motivation: 85, phase: 'up', next: 'Keep pushing' },
      thinking: { development: null, motivation: null, phase: null, next: 'No evidence' },
    });
    expect(parsed?.vision.development).toBe(72);
    expect(parsed?.vision.motivation).toBe(85);
    expect(parsed?.vision.phase).toBe('up');
    expect(hasDualLayerQedData(parsed)).toBe(true);
  });

  it('qedMeasureToChartValue uses 0-100 chart scale', () => {
    expect(qedMeasureToChartValue(72)).toBe(72);
    expect(qedMeasureToChartValue(null)).toBeNull();
  });

  it('averageQedMeasuresAcrossSnapshots averages D and M independently', () => {
    const avg = averageQedMeasuresAcrossSnapshots([
      {
        qed_measures: {
          vision: { development: 60, motivation: 80, phase: null, next: null },
        },
      },
      {
        qed_measures: {
          vision: { development: 80, motivation: 60, phase: null, next: null },
        },
      },
    ]);
    expect(avg?.vision.development).toBe(70);
    expect(avg?.vision.motivation).toBe(70);
  });
});
