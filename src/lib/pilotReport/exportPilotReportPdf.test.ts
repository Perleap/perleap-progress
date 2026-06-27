import { describe, it, expect } from 'vitest';
import {
  A4_HEIGHT_MM,
  PAGE_MARGIN_MM,
  blockHeightMm,
  computeVerticalSlices,
  contentAreaMm,
  fitBlockDimensionsMm,
  fitBlockWidthMm,
  needsNewPage,
  scaleToFitPageMm,
} from './exportPilotReportPdf';

describe('fitBlockWidthMm', () => {
  it('uses full content width', () => {
    const { width } = contentAreaMm();
    const result = fitBlockWidthMm(860, width);
    expect(result.widthMm).toBe(width);
    expect(result.xMm).toBe(PAGE_MARGIN_MM);
  });
});

describe('blockHeightMm', () => {
  it('preserves aspect ratio at full width', () => {
    const { width } = contentAreaMm();
    const heightMm = blockHeightMm(400, 860, width);
    expect(heightMm).toBeCloseTo((400 / 860) * width);
  });
});

describe('computeVerticalSlices', () => {
  it('returns one slice when block fits on a page', () => {
    const { width, height } = contentAreaMm();
    const slices = computeVerticalSlices(400, 860, width, height);
    expect(slices).toHaveLength(1);
    expect(slices[0].sourceY).toBe(0);
    expect(slices[0].sliceHeightPx).toBe(400);
  });

  it('splits tall blocks across multiple full-width slices', () => {
    const { width, height } = contentAreaMm();
    const slices = computeVerticalSlices(4000, 860, width, height);
    expect(slices.length).toBeGreaterThan(1);

    const totalPx = slices.reduce((sum, slice) => sum + slice.sliceHeightPx, 0);
    expect(totalPx).toBe(4000);

    for (const slice of slices) {
      expect(slice.heightMm).toBeLessThanOrEqual(height + 0.01);
    }
  });
});

describe('scaleToFitPageMm', () => {
  it('preserves aspect ratio when block fits on page', () => {
    const { width, height } = contentAreaMm();
    const result = scaleToFitPageMm(860, 400, width, height);
    expect(result.widthMm).toBe(width);
    expect(result.heightMm).toBeCloseTo((400 / 860) * width);
    expect(result.xMm).toBe(PAGE_MARGIN_MM);
  });

  it('scales width and height proportionally when block exceeds page height', () => {
    const { width, height } = contentAreaMm();
    const result = scaleToFitPageMm(860, 4000, width, height);
    expect(result.heightMm).toBe(height);
    expect(result.widthMm).toBeLessThan(width);
    expect(result.xMm).toBeGreaterThan(PAGE_MARGIN_MM);
  });
});

describe('fitBlockDimensionsMm', () => {
  it('preserves aspect ratio when block fits on page', () => {
    const { width, height } = contentAreaMm();
    const result = fitBlockDimensionsMm(860, 400, width, height);
    expect(result.widthMm).toBe(width);
    expect(result.heightMm).toBeCloseTo((400 / 860) * width);
    expect(result.xMm).toBe(PAGE_MARGIN_MM);
  });

  it('scales proportionally when block exceeds page height', () => {
    const { width, height } = contentAreaMm();
    const result = fitBlockDimensionsMm(860, 4000, width, height);
    expect(result.heightMm).toBe(height);
    expect(result.widthMm).toBeLessThan(width);
  });
});

describe('needsNewPage', () => {
  it('returns false for the first block on a page', () => {
    const { height } = contentAreaMm();
    expect(needsNewPage(PAGE_MARGIN_MM, 50, PAGE_MARGIN_MM, height)).toBe(false);
  });

  it('returns true when the block would overflow the page', () => {
    const { height } = contentAreaMm();
    const currentY = PAGE_MARGIN_MM + height - 20;
    expect(needsNewPage(currentY, 40, PAGE_MARGIN_MM, height)).toBe(true);
  });
});

describe('contentAreaMm', () => {
  it('subtracts margins from A4 dimensions', () => {
    const { width, height } = contentAreaMm();
    expect(width).toBe(210 - PAGE_MARGIN_MM * 2);
    expect(height).toBe(A4_HEIGHT_MM - PAGE_MARGIN_MM * 2);
  });
});
