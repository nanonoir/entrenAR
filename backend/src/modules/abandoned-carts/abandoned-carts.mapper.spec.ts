import {
  CheckoutRecoveryStatus,
  CheckoutSessionStatus,
} from "../../generated/prisma/enums";
import {
  toAbandonedCartDetailDto,
  toAbandonedCartListItemDto,
  type AbandonedCartSessionRecord,
} from "./abandoned-carts.mapper";

describe("abandoned carts mapper", () => {
  it("prefers immutable snapshots and generates an opaque recovery URL", () => {
    const session = makeSession({
      recoveryExpiresAt: new Date("2026-09-12T10:00:00.000Z"),
      snapshotData: {
        customer: { email: "snapshot@example.com", firstName: "Snapshot", lastName: "Customer" },
        items: [{ lineSubtotal: 20, name: "Historical product", productId: "product-1", quantity: 2, unitPrice: 10 }],
        total: 20,
      },
      user: { email: "live@example.com", firstName: "Live", id: "user-1", lastName: "User", phone: null, dni: null },
    });

    const mapped = toAbandonedCartDetailDto(session, { now: new Date("2026-09-05T10:00:00.000Z"), recoveryToken: "raw-token" });

    expect(mapped.customer).toEqual({ email: "snapshot@example.com", firstName: "Snapshot", lastName: "Customer" });
    expect(mapped.items).toEqual([{ lineSubtotal: 20, name: "Historical product", productId: "product-1", quantity: 2, unitPrice: 10 }]);
    expect(mapped.total).toBe(20);
    expect(mapped.recoveryLink).toEqual({
      expiresAt: "2026-09-12T10:00:00.000Z",
      isExpired: false,
      url: "/checkout?recoveryToken=raw-token",
    });
  });

  it("falls back to live cart items and user data when the snapshot is incomplete", () => {
    const session = makeSession({
      snapshotData: { customer: {}, items: [] },
      user: { dni: "30123456", email: "live@example.com", firstName: "Live", id: "user-1", lastName: "User", phone: "+54 11" },
      cart: {
        items: [{
          id: "item-1",
          productId: "product-1",
          quantity: 2,
          variantId: "variant-1",
          product: { id: "product-1", imageTone: null, name: "Live product", promotionalPrice: null, salePrice: "12.50", sku: "SKU-1" },
          variant: { compareAtPrice: null, id: "variant-1", name: "Blue", price: "10.00", sku: "SKU-V" },
        }],
        user: null,
      },
    });

    expect(toAbandonedCartListItemDto(session)).toEqual(expect.objectContaining({
      customer: { dni: "30123456", email: "live@example.com", firstName: "Live", lastName: "User", phone: "+54 11" },
      products: [{ lineSubtotal: 20, name: "Live product", productId: "product-1", quantity: 2, sku: "SKU-V", unitPrice: 10, variantId: "variant-1", variantName: "Blue" }],
      total: 20,
    }));
  });

  it("sorts history chronologically with the id as a stable tie-breaker", () => {
    const session = makeSession({
      history: [
        history("b", "2026-09-03T10:00:00.000Z"),
        history("a", "2026-09-03T10:00:00.000Z"),
        history("c", "2026-09-03T09:00:00.000Z"),
      ],
    });

    expect(toAbandonedCartDetailDto(session).timeline.map((event) => event.id)).toEqual(["c", "a", "b"]);
  });
});

function makeSession(overrides: Record<string, unknown> = {}): AbandonedCartSessionRecord {
  return {
    abandonedAt: new Date("2026-09-03T10:00:00.000Z"),
    cartId: "cart-1",
    completedAt: null,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    expiresAt: null,
    history: [],
    id: "session-1",
    lastActivityAt: new Date("2026-09-03T10:00:00.000Z"),
    lastEmailSentAt: null,
    recoveryExpiresAt: null,
    recoveryStatus: CheckoutRecoveryStatus.PENDING,
    recoveryTokenHash: null,
    snapshotData: {},
    status: CheckoutSessionStatus.ABANDONED,
    tokenHash: "session-hash",
    updatedAt: new Date("2026-09-03T10:00:00.000Z"),
    userId: null,
    user: null,
    order: null,
    cart: { id: "cart-1", status: "ABANDONED", userId: null, createdAt: new Date(), updatedAt: new Date(), user: null, items: [] },
    ...overrides,
  } as unknown as AbandonedCartSessionRecord;
}

function history(id: string, createdAt: string) {
  return { actorId: null, actorRole: "SYSTEM", checkoutSessionId: "session-1", createdAt: new Date(createdAt), eventType: "SESSION_ABANDONED", id, metadata: {}, notes: null };
}
