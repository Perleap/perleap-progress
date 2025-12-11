/**
 * Role Recovery Utilities
 * 
 * Handles recovery of user role metadata when it's missing or incomplete.
 * This can happen due to network failures, browser closures during signup,
 * or API errors.
 */

import { supabase } from '@/integrations/supabase/client';

const PENDING_ROLE_KEY = 'pending_role';
const ROLE_RECOVERY_ATTEMPT_KEY = 'role_recovery_attempt';

/**
 * Save role to localStorage as a backup during signup
 */
export const savePendingRole = (role: 'teacher' | 'student'): void => {
  try {
    localStorage.setItem(PENDING_ROLE_KEY, role);
    console.log('💾 Role saved to localStorage as backup:', role);
  } catch (error) {
    console.error('Failed to save pending role:', error);
  }
};

/**
 * Get pending role from localStorage
 */
export const getPendingRole = (): string | null => {
  try {
    return localStorage.getItem(PENDING_ROLE_KEY);
  } catch (error) {
    console.error('Failed to get pending role:', error);
    return null;
  }
};

/**
 * Clear pending role from localStorage
 */
export const clearPendingRole = (): void => {
  try {
    localStorage.removeItem(PENDING_ROLE_KEY);
    console.log('🗑️ Cleared pending role from localStorage');
  } catch (error) {
    console.error('Failed to clear pending role:', error);
  }
};

/**
 * Update user's role metadata in Supabase Auth
 */
export const updateUserRole = async (role: 'teacher' | 'student'): Promise<boolean> => {
  try {
    console.log('🔄 Attempting to update user role to:', role);
    
    const { data, error } = await supabase.auth.updateUser({
      data: { role },
    });

    if (error) {
      console.error('❌ Failed to update user role:', error);
      return false;
    }

    if (data?.user?.user_metadata?.role === role) {
      console.log('✅ User role updated successfully:', role);
      return true;
    }

    console.warn('⚠️ User role update returned success but role not confirmed');
    return false;
  } catch (error) {
    console.error('❌ Exception updating user role:', error);
    return false;
  }
};

/**
 * Verify that user's role metadata is set correctly
 */
export const verifyUserRole = async (): Promise<{
  hasRole: boolean;
  role: string | null;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { hasRole: false, role: null };
    }

    const role = user.user_metadata?.role;
    const hasRole = role === 'teacher' || role === 'student';

    console.log('🔍 Role verification:', { hasRole, role, userId: user.id });

    return { hasRole, role };
  } catch (error) {
    console.error('❌ Error verifying user role:', error);
    return { hasRole: false, role: null };
  }
};

/**
 * Check if user has both auth account and valid role
 */
export const isRegistrationComplete = async (): Promise<boolean> => {
  const { hasRole } = await verifyUserRole();
  return hasRole;
};

/**
 * Attempt to recover role from various sources
 */
export const attemptRoleRecovery = async (): Promise<{
  recovered: boolean;
  role: string | null;
  source: 'metadata' | 'localStorage' | 'none';
}> => {
  // First check if role is already in metadata
  const { hasRole, role: metadataRole } = await verifyUserRole();
  
  if (hasRole && metadataRole) {
    return { recovered: true, role: metadataRole, source: 'metadata' };
  }

  // Try to recover from localStorage
  const pendingRole = getPendingRole();
  
  if (pendingRole && (pendingRole === 'teacher' || pendingRole === 'student')) {
    console.log('🔄 Attempting to recover role from localStorage:', pendingRole);
    
    const updated = await updateUserRole(pendingRole as 'teacher' | 'student');
    
    if (updated) {
      clearPendingRole();
      return { recovered: true, role: pendingRole, source: 'localStorage' };
    }
  }

  return { recovered: false, role: null, source: 'none' };
};

/**
 * Track recovery attempts to prevent infinite loops
 */
export const incrementRecoveryAttempt = (): number => {
  try {
    const current = parseInt(localStorage.getItem(ROLE_RECOVERY_ATTEMPT_KEY) || '0');
    const next = current + 1;
    localStorage.setItem(ROLE_RECOVERY_ATTEMPT_KEY, next.toString());
    return next;
  } catch (error) {
    return 1;
  }
};

/**
 * Reset recovery attempt counter
 */
export const resetRecoveryAttempts = (): void => {
  try {
    localStorage.removeItem(ROLE_RECOVERY_ATTEMPT_KEY);
  } catch (error) {
    console.error('Failed to reset recovery attempts:', error);
  }
};

/**
 * Check if we should attempt recovery (max 3 attempts)
 */
export const shouldAttemptRecovery = (): boolean => {
  try {
    const attempts = parseInt(localStorage.getItem(ROLE_RECOVERY_ATTEMPT_KEY) || '0');
    return attempts < 3;
  } catch (error) {
    return true;
  }
};

