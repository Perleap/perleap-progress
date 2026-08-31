/** Case-insensitive trimmed equality for destructive-action typed confirms. */
export function matchesTypedConfirm(input: string, expected: string): boolean {
  return input.trim().toLowerCase() === expected.trim().toLowerCase();
}
