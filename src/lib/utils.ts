import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Detects the text direction based on the first meaningful character.
 * Hebrew characters (Unicode range \u0590-\u05FF) return 'rtl', otherwise 'ltr'.
 */
export function detectTextDirection(text: string): 'rtl' | 'ltr' {
  // Find the first letter character (skip spaces, numbers, symbols)
  const letterMatch = text.match(/[\p{L}]/u);
  if (!letterMatch) return 'ltr';
  
  const firstLetter = letterMatch[0];
  const hebrewRegex = /[\u0590-\u05FF]/;
  return hebrewRegex.test(firstLetter) ? 'rtl' : 'ltr';
}