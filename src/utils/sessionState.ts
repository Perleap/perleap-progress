/**
 * Session State Management
 * 
 * Tracks signup progress to prevent confusion between:
 * - Active signup flow (user just registered, going through onboarding)
 * - Truly stuck users (old session, missing role metadata)
 */

const SIGNUP_IN_PROGRESS_KEY = 'signup_in_progress';
const SIGNUP_TIMESTAMP_KEY = 'signup_timestamp';

/**
 * Mark that signup is in progress
 * Called when user begins signup process
 */
export const markSignupInProgress = (): void => {
  try {
    sessionStorage.setItem(SIGNUP_IN_PROGRESS_KEY, 'true');
    sessionStorage.setItem(SIGNUP_TIMESTAMP_KEY, Date.now().toString());
    console.log('✅ Signup marked as in progress');
  } catch (error) {
    console.error('Failed to mark signup in progress:', error);
  }
};

/**
 * Mark that signup is complete
 * Called after onboarding is successfully completed
 */
export const markSignupComplete = (): void => {
  try {
    sessionStorage.removeItem(SIGNUP_IN_PROGRESS_KEY);
    sessionStorage.removeItem(SIGNUP_TIMESTAMP_KEY);
    console.log('✅ Signup marked as complete');
  } catch (error) {
    console.error('Failed to mark signup complete:', error);
  }
};

/**
 * Check if signup is currently in progress
 * Returns false if:
 * - Flag is not set
 * - Signup started more than 30 minutes ago (timed out)
 */
export const isSignupInProgress = (): boolean => {
  try {
    const inProgress = sessionStorage.getItem(SIGNUP_IN_PROGRESS_KEY) === 'true';
    
    if (!inProgress) {
      return false;
    }

    // Check if signup has timed out (30 minutes)
    const timestamp = sessionStorage.getItem(SIGNUP_TIMESTAMP_KEY);
    if (timestamp) {
      const signupTime = parseInt(timestamp);
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;
      
      if (now - signupTime > thirtyMinutes) {
        console.warn('⚠️ Signup timed out (30+ minutes), clearing flags');
        markSignupComplete();
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to check signup status:', error);
    return false;
  }
};

/**
 * Clear all signup-related state
 * Used on sign out or when cleaning up
 */
export const clearAllSignupState = (): void => {
  try {
    sessionStorage.removeItem(SIGNUP_IN_PROGRESS_KEY);
    sessionStorage.removeItem(SIGNUP_TIMESTAMP_KEY);
    console.log('🗑️ Cleared all signup state');
  } catch (error) {
    console.error('Failed to clear signup state:', error);
  }
};

/**
 * Check how long signup has been in progress
 * Returns milliseconds, or null if not in progress
 */
export const getSignupDuration = (): number | null => {
  try {
    if (!isSignupInProgress()) {
      return null;
    }

    const timestamp = sessionStorage.getItem(SIGNUP_TIMESTAMP_KEY);
    if (!timestamp) {
      return null;
    }

    return Date.now() - parseInt(timestamp);
  } catch (error) {
    return null;
  }
};

