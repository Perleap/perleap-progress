/**
 * Shared Types for Edge Functions
 * Common type definitions used across Supabase edge functions
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface FiveDScores {
  vision: number;
  values: number;
  thinking: number;
  connection: number;
  action: number;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
}

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

