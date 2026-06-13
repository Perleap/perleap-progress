export function parseOptionIds(
  value: unknown,
  legacySingleId?: string | null,
): string[] {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  if (legacySingleId) {
    return [legacySingleId];
  }
  return [];
}

export function optionLabelsForIds(
  options: { id: string; text: string }[] | null | undefined,
  ids: string[],
): string[] {
  if (!options || ids.length === 0) return ids;
  return ids.map((id) => {
    const option = options.find((o) => o.id === id);
    return option?.text?.trim() || id;
  });
}
