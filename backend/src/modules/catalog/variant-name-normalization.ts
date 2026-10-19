import { deriveVariantLabel, isPlaceholderVariantName } from "./variant-label";

export interface VariantNameRow {
  attributes: unknown;
  id: string;
  name: string;
  productName: string;
  sku: string;
  variantProperties: unknown;
}

export interface VariantNameChange { from: string; id: string; sku: string; to: string }

export interface VariantNameNormalizationPlan {
  changes: VariantNameChange[];
  /** Names that are custom (not empty, not the SKU): never touched. */
  customNames: number;
  /** Placeholder names with structured data that cannot produce a safe label. */
  unresolved: VariantNameChange["id"][];
}

/**
 * Plans the rename of placeholder variant names (empty or equal to the SKU). Structured products use
 * their attribute labels; simple products (no declared properties) use the product name. Nothing else
 * is derived, and `sku`, stock and prices are never part of the plan.
 */
export function planVariantNameNormalization(rows: readonly VariantNameRow[]): VariantNameNormalizationPlan {
  const changes: VariantNameChange[] = [];
  const unresolved: string[] = [];
  let customNames = 0;

  for (const row of rows) {
    if (!isPlaceholderVariantName(row.name, row.sku)) {
      customNames += 1;
      continue;
    }

    const isSimple = Array.isArray(row.variantProperties) && row.variantProperties.length === 0;
    const label = isSimple ? row.productName.trim() || undefined : deriveVariantLabel(row.variantProperties, row.attributes);

    if (label && label !== row.name) changes.push({ from: row.name, id: row.id, sku: row.sku, to: label });
    else if (!label) unresolved.push(row.id);
  }

  return { changes, customNames, unresolved };
}
