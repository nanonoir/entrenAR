import { z } from "zod";

const sourceCategorySchema = z.object({
  sourceCategory: z.string().trim().min(1),
  path: z.array(z.string().trim().min(1)).min(1),
}).strict();

const sourceImageSchema = z.object({
  id: z.string().trim().min(1),
  url: z.url(),
}).strict();

const sourceVariantSchema = z.object({
  id: z.string().trim().min(1),
  sku: z.string().trim(),
  price: z.number().finite().optional(),
  compareAtPrice: z.number().finite().optional(),
  options: z.record(z.string(), z.string()),
  stockMode: z.enum(["TRACKED", "INFINITE"]),
  quantity: z.number().int().nonnegative().optional(),
  imageId: z.string().trim().min(1).optional(),
  logistics: z.object({
    weightGrams: z.number().finite().optional(),
    heightCm: z.number().finite().optional(),
    widthCm: z.number().finite().optional(),
    lengthCm: z.number().finite().optional(),
  }).strict(),
}).strict().superRefine((variant, context) => {
  if (variant.stockMode === "TRACKED" && variant.quantity === undefined) {
    context.addIssue({ code: "custom", path: ["quantity"], message: "Tracked stock requires a quantity." });
  }
  if (variant.stockMode === "INFINITE" && variant.quantity !== undefined) {
    context.addIssue({ code: "custom", path: ["quantity"], message: "Infinite stock cannot carry a tracked quantity." });
  }
});

export const sourceProductSchema = z.object({
  sourceUrl: z.url(),
  sourceId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  brand: z.string().trim().min(1).optional(),
  descriptionHtml: z.string(),
  categories: z.array(sourceCategorySchema),
  gallery: z.array(sourceImageSchema),
  variants: z.array(sourceVariantSchema),
}).strict().superRefine((product, context) => {
  const imageIds = new Set(product.gallery.map((image) => image.id));
  const galleryIds = product.gallery.map((image) => image.id);
  if (new Set(galleryIds).size !== galleryIds.length) context.addIssue({ code: "custom", path: ["gallery"], message: "Gallery image IDs must be unique." });
  const variantIds = product.variants.map((variant) => variant.id);
  if (new Set(variantIds).size !== variantIds.length) context.addIssue({ code: "custom", path: ["variants"], message: "Variant IDs must be unique." });
  for (const [index, variant] of product.variants.entries()) {
    if (variant.imageId && !imageIds.has(variant.imageId)) {
      context.addIssue({ code: "custom", path: ["variants", index, "imageId"], message: "Variant image must belong to the product gallery." });
    }
  }
});

export type SourceProduct = z.infer<typeof sourceProductSchema>;

export class SystemicSourceSchemaError extends Error {
  constructor(readonly sourceUrl = "", readonly detail = "Structured source state did not match the approved decoder.", readonly attemptedUrls: readonly string[] = sourceUrl ? [sourceUrl] : []) {
    super("Malformed structured product state.");
    this.name = "SystemicSourceSchemaError";
  }
}

export function decodeSourceProduct(input: unknown, sourceUrl = ""): SourceProduct {
  const result = sourceProductSchema.safeParse(input);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join(".") || "product"}: ${issue.message}`).join("; ");
    throw new SystemicSourceSchemaError(sourceUrl, detail);
  }
  return result.data;
}
