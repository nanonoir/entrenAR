import { z } from "zod";

import { INVENTORY_OPERATION, INVENTORY_STOCK_MODE } from "./inventory.constants";

const inventoryOperationValues = Object.values(INVENTORY_OPERATION) as [
  (typeof INVENTORY_OPERATION)[keyof typeof INVENTORY_OPERATION],
  ...(typeof INVENTORY_OPERATION)[keyof typeof INVENTORY_OPERATION][],
];

const inventoryStockModeValues = Object.values(INVENTORY_STOCK_MODE) as [
  (typeof INVENTORY_STOCK_MODE)[keyof typeof INVENTORY_STOCK_MODE],
  ...(typeof INVENTORY_STOCK_MODE)[keyof typeof INVENTORY_STOCK_MODE][],
];

const identifierSchema = z.string().trim().min(1).max(128);

export const inventoryUpdateSchema = z.object({
  operation: z.enum(inventoryOperationValues),
  quantity: z.number().int().nonnegative().optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  stockMode: z.enum(inventoryStockModeValues).optional(),
  variantId: identifierSchema.optional(),
}).strict().superRefine((input, context) => {
  if (input.operation === INVENTORY_OPERATION.REPLACE) {
    if (!input.stockMode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "stockMode is required when replacing inventory.",
        path: ["stockMode"],
      });
      return;
    }

    if (input.stockMode === INVENTORY_STOCK_MODE.LIMITED && input.quantity === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "quantity is required when replacing with limited inventory.",
        path: ["quantity"],
      });
    }

    if (input.stockMode === INVENTORY_STOCK_MODE.INFINITE && input.quantity !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "quantity must be omitted when replacing with infinite inventory.",
        path: ["quantity"],
      });
    }

    return;
  }

  if (input.stockMode !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "stockMode is only valid for replace operations.",
      path: ["stockMode"],
    });
  }

  if (input.quantity === undefined || input.quantity === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "quantity must be a positive integer for add or subtract operations.",
      path: ["quantity"],
    });
  }
});

export const inventoryHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  page: z.coerce.number().int().min(1).default(1),
  productId: identifierSchema.optional(),
  variantId: identifierSchema.optional(),
}).strict();

export type InventoryHistoryQuery = z.infer<typeof inventoryHistoryQuerySchema>;
export type InventoryUpdateInput = z.infer<typeof inventoryUpdateSchema>;
