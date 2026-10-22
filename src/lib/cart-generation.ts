/** The exact lines and quantities that were submitted for payment; later cart edits are a different generation. */
export interface CartGenerationLine {
  productId: string;
  quantity: number;
  variantId: string;
}

export type CartGeneration = readonly CartGenerationLine[];

interface CartLineLike {
  productId: string;
  quantity: number;
  variantId?: string | undefined;
}

function lineKey(productId: string, variantId: string | undefined): string {
  return `${productId.trim()}:${variantId?.trim() ?? ""}`;
}

/** Captures the submitted lines (sorted, merged by product variant) so cleanup can remove exactly them. */
export function captureCartGeneration(lines: readonly CartLineLike[]): CartGeneration {
  const merged = new Map<string, CartGenerationLine>();

  for (const line of lines) {
    const key = lineKey(line.productId, line.variantId);
    const current = merged.get(key);
    if (current) current.quantity += line.quantity;
    else merged.set(key, { productId: line.productId.trim(), quantity: line.quantity, variantId: line.variantId?.trim() ?? "" });
  }

  return [...merged.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, line]) => line);
}

export function fingerprintCartGeneration(generation: CartGeneration): string {
  return generation.map((line) => `${lineKey(line.productId, line.variantId)}x${line.quantity}`).join("|");
}

/**
 * Removes only the submitted quantities from the current cart. Lines added or increased after submission
 * keep their surplus. Callers guard idempotency with a finalized flag: applying the same generation twice
 * would subtract it twice.
 */
export function removeSubmittedGeneration<T extends CartLineLike>(
  items: readonly T[],
  generation: CartGeneration,
): T[] {
  const submitted = new Map<string, number>();
  for (const line of generation) {
    const key = lineKey(line.productId, line.variantId);
    submitted.set(key, (submitted.get(key) ?? 0) + line.quantity);
  }

  const remaining: T[] = [];
  for (const item of items) {
    const key = lineKey(item.productId, item.variantId);
    const toRemove = submitted.get(key) ?? 0;
    if (toRemove <= 0) {
      remaining.push(item);
      continue;
    }

    const removed = Math.min(toRemove, item.quantity);
    submitted.set(key, toRemove - removed);
    if (item.quantity - removed > 0) remaining.push({ ...item, quantity: item.quantity - removed });
  }

  return remaining;
}
