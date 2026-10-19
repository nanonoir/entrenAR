const MAX_VISIBLE_LENGTH = 14;

/** Shortens long opaque identifiers (hashes, prefixed ids) for display. It is not an order number; the full id stays the source of truth. */
export function shortReference(id: string): string {
  if (id.length <= MAX_VISIBLE_LENGTH) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
