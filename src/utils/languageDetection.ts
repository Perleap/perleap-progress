/**
 * Language Detection Utilities
 * Detect language from text content
 */

/**
 * Detect if text contains Hebrew characters
 */
export function containsHebrew(text: string): boolean {
  // Hebrew Unicode range: \u0590-\u05FF
  const hebrewRegex = /[\u0590-\u05FF]/;
  return hebrewRegex.test(text);
}

/**
 * Detect language from text content
 * Returns 'he' if Hebrew characters detected, otherwise 'en'
 */
export function detectLanguage(text: string): 'he' | 'en' {
  if (!text) return 'en';
  
  // Check if text contains Hebrew characters
  if (containsHebrew(text)) {
    return 'he';
  }
  
  return 'en';
}

/**
 * Get language for assignment based on instructions
 * Prioritizes instruction language over UI language
 */
export function getAssignmentLanguage(
  instructions: string,
  uiLanguage: 'he' | 'en'
): 'he' | 'en' {
  // If instructions contain Hebrew, use Hebrew regardless of UI language
  if (containsHebrew(instructions)) {
    return 'he';
  }
  
  // Otherwise, instructions are in English/Latin script
  // Always use English for non-Hebrew instructions regardless of UI language
  return 'en';
}

