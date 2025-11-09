/**
 * API Client
 * Centralized Supabase client with error handling
 */

import { supabase } from '@/integrations/supabase/client';
import type { ApiError } from '@/types';

/**
 * Handle Supabase errors and convert to ApiError format
 */
export const handleSupabaseError = (error: unknown): ApiError => {
  if (error && typeof error === 'object' && 'message' in error) {
    return {
      message: (error as { message: string }).message,
      code: 'code' in error ? (error as { code: string }).code : undefined,
      details: error,
    };
  }
  return {
    message: 'An unexpected error occurred',
    details: error,
  };
};

/**
 * Type-safe wrapper for Supabase queries with error handling
 */
export const safeQuery = async <T>(
  queryFn: () => Promise<{ data: T | null; error: unknown }>,
): Promise<{ data: T | null; error: ApiError | null }> => {
  try {
    const { data, error } = await queryFn();
    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export { supabase };

