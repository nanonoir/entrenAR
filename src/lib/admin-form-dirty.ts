function normalize(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return Number.isNaN(value) ? undefined : value;
  if (Array.isArray(value)) return value.map(normalize);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, normalize(entry)] as const)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return entries.length === 0 ? undefined : Object.fromEntries(entries);
  }
  return value;
}

/**
 * Compares form values against a baseline treating empty string, null, undefined and NaN as the same "empty" value.
 * Native inputs (valueAsNumber, radios) can report "" or NaN for fields that default to undefined, which makes
 * react-hook-form flag an untouched form as dirty and arms the beforeunload guard without user input.
 */
export function hasFormChanges(baseline: unknown, current: unknown): boolean {
  return JSON.stringify(normalize(baseline)) !== JSON.stringify(normalize(current));
}
