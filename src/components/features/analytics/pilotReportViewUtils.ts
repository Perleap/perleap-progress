import type { CSSProperties } from 'react';
import type { PilotParticipantRow } from '@/lib/pilotReport/types';

export const BLUE = {
  primary: '#3369B7',
  dark: '#1B3A6B',
  labelBg: '#E8F0FA',
  headerBg: '#D6E4F5',
  border: '#B8CFE8',
};

export const SUMMARY_COLUMN_STYLES = {
  strength: {
    header: '#1E7A45',
    background: '#E2F5EA',
    text: '#1a5c35',
    border: '#B5E0C6',
  },
  risk: {
    header: '#B43333',
    background: '#FDE8E8',
    text: '#8c2828',
    border: '#ECB8B8',
  },
  action: {
    header: '#3369B7',
    background: '#E8F0FA',
    text: '#1B3A6B',
    border: '#B8CFE8',
  },
} as const;

export const BADGE_SIZE_PX = 56;

export function badgeCircleStyle(sizePx: number, extra?: CSSProperties): CSSProperties {
  return {
    width: sizePx,
    height: sizePx,
    minWidth: sizePx,
    minHeight: sizePx,
    display: 'inline-grid',
    placeItems: 'center',
    justifyItems: 'center',
    textAlign: 'center',
    direction: 'ltr',
    boxSizing: 'border-box',
    ...extra,
  };
}

export function readinessPillStyle(readiness: PilotParticipantRow['readiness']): CSSProperties {
  switch (readiness) {
    case 'ready':
      return { backgroundColor: '#E2F5EA', color: '#1E7A45', borderColor: '#B5E0C6' };
    case 'coach':
      return { backgroundColor: '#FFF4DC', color: '#946300', borderColor: '#EFD9A2' };
    case 'redirect':
      return { backgroundColor: '#EDE8FA', color: '#5B41A8', borderColor: '#CFC3EE' };
    case 'not_ready':
      return { backgroundColor: '#FDE8E8', color: '#B43333', borderColor: '#ECB8B8' };
    default:
      return { backgroundColor: BLUE.headerBg, color: BLUE.primary, borderColor: BLUE.border };
  }
}
