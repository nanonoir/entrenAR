import { z } from "zod";

export const wishlistProductIdSchema = z.string({ error: "Product ID must be a string." })
  .trim()
  .min(1, { error: "Product ID is required." })
  .max(128, { error: "Product ID is too long." });

export const wishlistProductParamsSchema = z.object({
  productId: wishlistProductIdSchema,
}).strict();

export const wishlistItemSchema = wishlistProductParamsSchema;
export const wishlistMutationSchema = wishlistProductParamsSchema;

export type WishlistProductParams = z.infer<typeof wishlistProductParamsSchema>;
export type WishlistItemInput = z.infer<typeof wishlistItemSchema>;
