import { CheckoutRecoveryStatus } from "../../generated/prisma/enums";
import {
  abandonedCartDetailResponseSchema,
  abandonedCartListQuerySchema,
  abandonedCartListResponseSchema,
  convertCartSchema,
  discardCartSchema,
  manualRecoverySchema,
  recoveryTimingSchema,
  sendRecoveryEmailSchema,
  updateRecoveryConfigSchema,
  updateRecoveryTemplateSchema,
} from "./abandoned-carts.schemas";

describe("abandoned-cart schemas", () => {
  it("coerces list filters, applies defaults, and validates ranges", () => {
    const parsed = abandonedCartListQuerySchema.parse({
      from: "2026-09-01",
      limit: "10",
      maxTotal: "90000",
      minTotal: "10000",
      page: "2",
      search: "  camila  ",
      sortBy: "total",
      sortOrder: "asc",
      status: "sent",
      to: "2026-09-03",
    });

    expect(parsed).toMatchObject({
      limit: 10,
      maxTotal: 90000,
      minTotal: 10000,
      page: 2,
      search: "camila",
      sortBy: "total",
      sortOrder: "asc",
      status: CheckoutRecoveryStatus.SENT,
    });
    expect(parsed.from).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(parsed.to).toEqual(new Date("2026-09-03T00:00:00.000Z"));
    expect(abandonedCartListQuerySchema.parse({})).toEqual({
      limit: 20,
      page: 1,
      sortBy: "abandonedAt",
      sortOrder: "desc",
    });
  });

  it.each([
    { from: "2026-09-04", to: "2026-09-03" },
    { minTotal: "100", maxTotal: "99" },
    { limit: "0" },
    { page: "0" },
    { search: "   " },
    { sortBy: "unknown" },
    { status: "unknown" },
    { unexpected: true },
  ])("rejects invalid list input: %o", (input) => {
    expect(abandonedCartListQuerySchema.safeParse(input).success).toBe(false);
  });

  it("accepts empty or optional recovery action payloads", () => {
    expect(sendRecoveryEmailSchema.parse(undefined)).toEqual({});
    expect(sendRecoveryEmailSchema.parse({ note: "  Call customer  ", subjectOverride: "  Cart saved  " })).toEqual({
      note: "Call customer",
      subjectOverride: "Cart saved",
    });
    expect(manualRecoverySchema.parse({})).toEqual({});
    expect(convertCartSchema.parse({ notes: "Customer requested a callback." })).toEqual({
      notes: "Customer requested a callback.",
    });
  });

  it("rejects unexpected, blank, and incomplete action payloads", () => {
    expect(sendRecoveryEmailSchema.safeParse({ unexpected: true }).success).toBe(false);
    expect(sendRecoveryEmailSchema.safeParse({ note: " " }).success).toBe(false);
    expect(manualRecoverySchema.safeParse({ note: " " }).success).toBe(false);
    expect(convertCartSchema.safeParse({ reason: "not supported" }).success).toBe(false);
    expect(discardCartSchema.safeParse({}).success).toBe(false);
    expect(discardCartSchema.safeParse({ reason: "no" }).success).toBe(false);
    expect(discardCartSchema.safeParse({ reason: "Valid reason", extra: true }).success).toBe(false);
  });

  it("validates recovery settings and preserves template content", () => {
    expect(recoveryTimingSchema.parse("14_days")).toBe("14_days");
    expect(updateRecoveryConfigSchema.parse({ isActive: true, timing: "manual" })).toEqual({
      isActive: true,
      timing: "manual",
    });
    expect(updateRecoveryConfigSchema.safeParse({ isActive: true, timing: "12hs" }).success).toBe(false);
    expect(updateRecoveryConfigSchema.safeParse({ isActive: "true", timing: "24hs" }).success).toBe(false);

    const template = {
      htmlBody: "  <p>{{nombre}}</p>  ",
      plainTextBody: "Hello {{nombre}}",
      subject: "Saved cart",
    };
    expect(updateRecoveryTemplateSchema.parse(template)).toEqual(template);
    expect(updateRecoveryTemplateSchema.safeParse({ subject: "", htmlBody: "<p>Body</p>" }).success).toBe(false);
    expect(updateRecoveryTemplateSchema.safeParse({ subject: "Subject", htmlBody: " ", plainTextBody: "Text" }).success).toBe(false);
  });

  it("validates list and detail response projections", () => {
    const item = {
      abandonedAt: "2026-09-02T10:00:00.000Z",
      customer: { email: "camila@example.com", firstName: "Camila", lastName: "Perez" },
      id: "session-1",
      products: [{ name: "Whey", productId: "product-1", quantity: 1, unitPrice: 100 }],
      recoveryStatus: CheckoutRecoveryStatus.PENDING,
      total: 100,
    };
    const summary = { pendingCount: 1, recoverableTotal: 100, recoveredCount: 0 };

    expect(abandonedCartListResponseSchema.parse({
      items: [item], limit: 20, page: 1, summary, total: 1, totalPages: 1,
    })).toMatchObject({ total: 1, totalPages: 1 });
    expect(abandonedCartDetailResponseSchema.parse({
      ...item,
      cartId: "cart-1",
      items: item.products,
      timeline: [],
    }).cartId).toBe("cart-1");
    expect(abandonedCartListResponseSchema.safeParse({
      items: [item], limit: 20, page: 1, summary, total: 1, totalPages: 1, unknown: true,
    }).success).toBe(false);
  });
});
