/**
 * Shared Types for Edge Functions
 * Common type definitions used across Supabase edge functions
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** OpenAI output for this assistant turn only (before polish, dash normalize, greeting prefix, persistence marker strip). */
  raw_model_text?: string;
  fileContext?: {
    name: string;
    content: string;
    url?: string;
    type?: string;
  };
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

