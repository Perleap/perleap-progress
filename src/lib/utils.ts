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

/**
 * Copies text to clipboard and returns a promise
 * @param text - The text to copy to clipboard
 * @returns Promise that resolves when copy is successful
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      textArea.remove();
    } catch {
      textArea.remove();
      throw new Error('Failed to copy');
    }
  }
}

/** True when `value` looks like a Postgres UUID (excludes optimistic `temp-*` client ids). */
export function isUuidLike(value: unknown): value is string {
  if (value == null || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
}
