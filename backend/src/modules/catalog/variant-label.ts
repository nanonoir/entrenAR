import { slugify } from "./catalog.schemas";

interface PropertyValue { id: string; label: string }
interface Property { id: string; values: PropertyValue[] }

/**
 * Builds `Negro / M` from the structured variant attributes. Returns `undefined` unless every declared
 * property resolves to a declared value label, so a label is never guessed.
 */
export function deriveVariantLabel(variantProperties: unknown, attributes: unknown): string | undefined {
  const properties = parseProperties(variantProperties);
  if (!properties || properties.length === 0 || !isRecord(attributes)) return undefined;

  const labels: string[] = [];
  for (const property of properties) {
    const valueId = attributes[property.id];
    const label = typeof valueId === "string" ? property.values.find((value) => value.id === valueId)?.label : undefined;
    if (!label) return undefined;
    labels.push(label);
  }

  return labels.join(" / ");
}

/** A stored name is a placeholder only when empty or identical to the SKU; any other name is custom. */
export function isPlaceholderVariantName(name: string | null | undefined, sku: string): boolean {
  const trimmed = name?.trim();
  return !trimmed || trimmed === sku;
}

/** The persisted name unless it is a placeholder and the structured data yields a readable label. */
export function resolveVariantLabel(
  variant: { attributes: unknown; name: string; sku: string },
  variantProperties: unknown,
): string {
  return isPlaceholderVariantName(variant.name, variant.sku)
    ? deriveVariantLabel(variantProperties, variant.attributes) ?? variant.name
    : variant.name;
}

function parseProperties(value: unknown): Property[] | undefined {
  if (!Array.isArray(value)) return undefined;

  // Same shapes as `variantPropertySchema`: the property id defaults to the slug of its name and a value may be a plain label.
  const properties: Property[] = [];
  for (const item of value) {
    if (!isRecord(item) || !Array.isArray(item["values"])) return undefined;
    const id = typeof item["id"] === "string" ? item["id"] : typeof item["name"] === "string" ? slugify(item["name"]) : undefined;
    if (!id) return undefined;
    const values = item["values"].flatMap((entry): PropertyValue[] => {
      if (typeof entry === "string") return [{ id: slugify(entry), label: entry }];
      return isRecord(entry) && typeof entry["id"] === "string" && typeof entry["label"] === "string"
        ? [{ id: entry["id"], label: entry["label"] }]
        : [];
    });
    properties.push({ id, values });
  }

  return properties;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
