/**
 * TypeScript types for Student Wellbeing Alerts
 */

export type AlertLevel = 'concerning' | 'critical';

export type AlertType = 'struggle' | 'self_harm_risk' | 'disengagement' | 'wants_to_quit';

export interface TriggeredMessage {
  message_index: number;
  content: string;
  reason: string;
}

export interface StudentAlert {
  id: string;
  submission_id: string;
  student_id: string;
  assignment_id: string;
  alert_level: AlertLevel;
  alert_type: AlertType;
  triggered_messages: TriggeredMessage[];
  ai_analysis: string;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
}

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  struggle: 'Severe Academic Struggle',
  self_harm_risk: 'Self-Harm Risk',
  disengagement: 'Disengagement',
  wants_to_quit: 'Wants to Quit',
};

export const ALERT_LEVEL_COLORS: Record<AlertLevel, { bg: string; text: string; border: string }> = {
  concerning: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
  },
  critical: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-500',
  },
};

