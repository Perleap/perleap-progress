/**
 * Types for Student Wellbeing Alert System
 */

export type AlertLevel = 'none' | 'concerning' | 'critical';

export type AlertType = 'struggle' | 'self_harm_risk' | 'disengagement' | 'wants_to_quit';

export interface TriggeredMessage {
  message_index: number;
  content: string;
  reason: string;
}

export interface WellbeingAnalysisResult {
  alert_level: AlertLevel;
  alert_types: AlertType[];
  triggered_messages: TriggeredMessage[];
  analysis: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

