/**
 * Next.js may hand dynamic segments over still percent-encoded (e.g. `crm-showcase%3A<hash>`).
 * Decode exactly once so adapters, which call `encodeURIComponent` themselves, never double-encode.
 * Malformed sequences are returned untouched instead of throwing during render.
 */
export function decodeRouteParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
