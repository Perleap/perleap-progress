import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';

/**
 * A hook that persists state to localStorage/sessionStorage
 * This helps preserve user data when navigating back/forward in the browser
 * 
 * @param key - Unique key for storing the state
 * @param initialValue - Initial value if no stored value exists
 * @param storage - 'local' for localStorage (persists across sessions) or 'session' for sessionStorage (cleared on tab close)
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  storage: 'local' | 'session' = 'session'
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const storageObject = storage === 'local' ? localStorage : sessionStorage;

  // Get stored value or use initial value
  const [state, setState] = useState<T>(() => {
    try {
      const item = storageObject.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Update storage when state changes
  useEffect(() => {
    try {
      storageObject.setItem(key, JSON.stringify(state));
    } catch {
      // Silently fail if storage is full or unavailable
    }
  }, [key, state, storageObject]);

  // Function to clear the persisted state
  const clearPersistedState = useCallback(() => {
    try {
      storageObject.removeItem(key);
      setState(initialValue);
    } catch {
      // Silently fail if storage is unavailable
    }
  }, [key, initialValue, storageObject]);

  return [state, setState, clearPersistedState];
}

/**
 * Save form data to prevent loss on navigation
 * Useful for forms, text inputs, etc.
 * 
 * Example usage:
 * ```tsx
 * const [formData, setFormData, clearFormData] = usePersistedState('my-form', { 
 *   name: '', 
 *   email: '' 
 * });
 * 
 * // On successful form submission:
 * clearFormData(); // Clear the saved data
 * ```
 */
export const usePersistedFormState = <T extends Record<string, any>>(
  formKey: string,
  initialValues: T
) => {
  return usePersistedState<T>(`form-${formKey}`, initialValues, 'session');
};

/**
 * Clear all persisted form data for a specific user
 * Useful when logging out or switching accounts
 */
export const clearAllPersistedForms = () => {
  const keys = Object.keys(sessionStorage);
  keys.forEach(key => {
    if (key.startsWith('form-')) {
      sessionStorage.removeItem(key);
    }
  });
};
