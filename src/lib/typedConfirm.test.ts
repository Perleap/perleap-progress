import { describe, expect, it } from 'vitest';
import { matchesTypedConfirm } from './typedConfirm';

describe('matchesTypedConfirm', () => {
  it('matches case-insensitively after trim', () => {
    expect(matchesTypedConfirm('  Confirm  ', 'confirm')).toBe(true);
    expect(matchesTypedConfirm('Verify Sandbox', 'verify sandbox')).toBe(true);
  });

  it('rejects partial or wrong input', () => {
    expect(matchesTypedConfirm('conf', 'confirm')).toBe(false);
    expect(matchesTypedConfirm('wrong', 'Verify Sandbox')).toBe(false);
  });
});
