import { createHash } from "node:crypto";

import { CheckoutRecoveryStatus, CheckoutSessionStatus, OrderStatus } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import type { AbandonedCartSessionRecord } from "./abandoned-carts.mapper";
import { AbandonedCartsRepository, type TransactionClient } from "./abandoned-carts.repository";
import { RECOVERY_STATUS, RECOVERY_TIMING } from "./abandoned-carts.schemas";
import { AbandonedCartsService } from "./abandoned-carts.service";

describe("AbandonedCartsService", () => {
  afterEach(() => jest.restoreAllMocks());

  it("lists mapped carts with pagination and summary metrics", async () => {
    const harness = createHarness();
    const session = makeSession();
    harness.repository.findMany.mockResolvedValue({
      items: [session],
      metrics: { pendingCount: 1, recoverableTotal: 125, recoveredCount: 2 },
      total: 3,
    });

    await expect(harness.service.listAbandonedCarts({ limit: 2, page: 2, sortBy: "abandonedAt", sortOrder: "desc" })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: session.id })],
      limit: 2,
      page: 2,
      summary: { pendingCount: 1, recoverableTotal: 125, recoveredCount: 2 },
      total: 3,
      totalPages: 2,
    });
    expect(harness.repository.findMany).toHaveBeenCalledWith(expect.objectContaining({ limit: 2, page: 2 }));
  });

  it("gets a cart detail and rejects missing sessions", async () => {
    const harness = createHarness();
    const session = makeSession();
    harness.repository.findById.mockResolvedValueOnce(session).mockResolvedValueOnce(null);

    await expect(harness.service.getAbandonedCartById(session.id)).resolves.toMatchObject({ id: session.id, cartId: session.cartId });
    await expect(harness.service.getAbandonedCartById(session.id)).rejects.toMatchObject({ status: 404 });
  });

  it("evaluates stale active sessions once and appends the abandonment event", async () => {
    const harness = createHarness();
    const now = new Date("2026-09-05T12:00:00.000Z");
    harness.repository.getSettings.mockResolvedValue({ ...makeSettings(), timing: RECOVERY_TIMING.TWENTY_FOUR_HOURS });
    harness.repository.findMany.mockResolvedValue({ items: [makeSession({ status: CheckoutSessionStatus.ACTIVE, lastActivityAt: new Date("2026-09-04T11:59:59.000Z") })], metrics: { pendingCount: 0, recoverableTotal: 0, recoveredCount: 0 }, total: 1 });
    (harness.transaction.checkoutSession.updateMany as unknown as jest.Mock).mockResolvedValue({ count: 1 });

    await expect(harness.service.evaluateAbandonment(now)).resolves.toBe(1);
    expect(harness.repository.appendHistoryEvent).toHaveBeenCalledWith(expect.any(String), "SESSION_ABANDONED", undefined, "SYSTEM", expect.any(String), { thresholdMs: 24 * 60 * 60 * 1_000 }, expect.anything());
  });

  it("generates a 32-byte token, stores only its SHA-256 hash, and logs the email event", async () => {
    const harness = createHarness();
    const current = makeSession({ recoveryStatus: CheckoutRecoveryStatus.PENDING });
    const updated = makeSession({
      lastEmailSentAt: new Date(),
      recoveryExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      recoveryStatus: CheckoutRecoveryStatus.SENT,
    });
    harness.repository.findById.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);

    const result = await harness.service.sendRecoveryEmail(current.id, { note: "Follow up" }, "admin-1", "ADMIN");
    const update = harness.repository.updateRecoveryEmailSent.mock.calls[0] as [string, string, Date, Date, TransactionClient];

    expect(Buffer.from(result.rawToken, "base64url")).toHaveLength(32);
    expect(update[1]).toBe(createHash("sha256").update(result.rawToken).digest("hex"));
    expect(update[2].getTime() - update[3].getTime()).toBe(7 * 24 * 60 * 60 * 1_000);
    expect(result.recoveryLink).toContain(`/checkout?recoveryToken=${encodeURIComponent(result.rawToken)}`);
    expect(harness.repository.appendHistoryEvent).toHaveBeenCalledWith(
      current.id,
      "RECOVERY_EMAIL_SENT",
      "admin-1",
      "ADMIN",
      "Follow up",
      expect.objectContaining({ channel: "email" }),
      expect.anything(),
    );
  });

  it("rejects an illegal or terminal email transition before mutation or history", async () => {
    const harness = createHarness();
    const current = makeSession({ recoveryStatus: CheckoutRecoveryStatus.RECOVERED });
    harness.repository.findById.mockResolvedValue(current);

    await expect(harness.service.sendRecoveryEmail(current.id)).rejects.toMatchObject({ status: 409 });
    expect(harness.repository.updateRecoveryEmailSent).not.toHaveBeenCalled();
    expect(harness.repository.appendHistoryEvent).not.toHaveBeenCalled();
  });

  it("marks manual recovery and stores the agent note", async () => {
    const harness = createHarness();
    const current = makeSession({ recoveryStatus: CheckoutRecoveryStatus.PENDING });
    const updated = makeSession({ recoveryStatus: CheckoutRecoveryStatus.MANUAL });
    harness.repository.findById.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);

    await expect(harness.service.markManualRecovery(current.id, { note: "Customer called" }, "admin-1", "ADMIN"))
      .resolves.toMatchObject({ recoveryStatus: CheckoutRecoveryStatus.MANUAL });
    expect(harness.repository.updateRecoveryStatus).toHaveBeenCalledWith(current.id, RECOVERY_STATUS.MANUAL, expect.anything());
    expect(harness.repository.appendHistoryEvent).toHaveBeenCalledWith(
      current.id,
      "MANUAL_CONTACT_LOGGED",
      "admin-1",
      "ADMIN",
      "Customer called",
      { channel: "manual" },
      expect.anything(),
    );
  });

  it("creates a pending order, completes the session, and logs conversion", async () => {
    const harness = createHarness();
    const current = makeSession({ recoveryStatus: CheckoutRecoveryStatus.MANUAL });
    const updated = makeSession({ recoveryStatus: CheckoutRecoveryStatus.RECOVERED, status: CheckoutSessionStatus.COMPLETED });
    harness.repository.findById.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    (harness.transaction.order.create as unknown as jest.Mock).mockResolvedValue({ id: "order-1" });

    const result = await harness.service.convertAbandonedCart(current.id, { notes: "Recovered by phone" }, "admin-1", "ADMIN");

    expect(result).toMatchObject({ id: current.id, orderId: "order-1", recoveryStatus: CheckoutRecoveryStatus.RECOVERED });
    expect(harness.transaction.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ checkoutSessionId: current.id, status: OrderStatus.PENDING }),
    }));
    expect(harness.repository.updateRecoveryStatus).toHaveBeenCalledWith(
      current.id,
      CheckoutRecoveryStatus.RECOVERED,
      expect.anything(),
      expect.objectContaining({ sessionStatus: CheckoutSessionStatus.COMPLETED }),
    );
    expect(harness.repository.appendHistoryEvent).toHaveBeenCalledWith(
      current.id,
      "SESSION_RECOVERED",
      "admin-1",
      "ADMIN",
      "Recovered by phone",
      { orderId: "order-1" },
      expect.anything(),
    );
  });

  it("requires a discard reason and rejects terminal discard transitions", async () => {
    const harness = createHarness();
    const current = makeSession({ recoveryStatus: CheckoutRecoveryStatus.PENDING });
    harness.repository.findById.mockResolvedValue(current);

    await expect(harness.service.discardAbandonedCart(current.id, { reason: "  " } as never)).rejects.toMatchObject({ status: 400 });
    expect(harness.repository.updateRecoveryStatus).not.toHaveBeenCalled();

    harness.repository.findById.mockResolvedValue(makeSession({ recoveryStatus: CheckoutRecoveryStatus.DISCARDED }));
    await expect(harness.service.discardAbandonedCart(current.id, { reason: "No longer needed" })).rejects.toMatchObject({ status: 409 });
    expect(harness.repository.appendHistoryEvent).not.toHaveBeenCalled();
  });

  it("reads and updates recovery configuration and email templates", async () => {
    const harness = createHarness();
    const settings = makeSettings();
    harness.repository.getSettings.mockResolvedValue(settings);
    harness.repository.updateSettings.mockResolvedValue({ ...settings, isActive: false, timing: "7_days" });

    await expect(harness.service.getRecoveryConfig()).resolves.toEqual({ isActive: true, timing: "24hs" });
    await expect(harness.service.updateRecoveryConfig({ isActive: false, timing: "7_days" })).resolves.toEqual({ isActive: false, timing: "7_days" });
    expect(harness.repository.updateSettings).toHaveBeenCalledWith({ isActive: false, timing: "7_days" });

    await expect(harness.service.getRecoveryTemplate()).resolves.toEqual({ htmlBody: settings.emailHtmlBody, plainTextBody: settings.emailPlainBody, subject: settings.emailSubject });
    await expect(harness.service.updateRecoveryTemplate({ htmlBody: "<p>Updated</p>", plainTextBody: "Updated", subject: "New subject" })).resolves.toEqual({
      htmlBody: settings.emailHtmlBody,
      plainTextBody: settings.emailPlainBody,
      subject: settings.emailSubject,
    });
    expect(harness.repository.updateSettings).toHaveBeenLastCalledWith({ emailHtmlBody: "<p>Updated</p>", emailPlainBody: "Updated", emailSubject: "New subject" });
  });
});

function createHarness() {
  const transaction = { cart: { update: jest.fn() }, checkoutSession: { updateMany: jest.fn() }, order: { create: jest.fn() }, orderItem: { createMany: jest.fn() }, orderPayment: { create: jest.fn() } } as unknown as TransactionClient;
  const repository = { appendHistoryEvent: jest.fn(), findById: jest.fn(), findMany: jest.fn(), getSettings: jest.fn(), runInTransaction: jest.fn((callback: (client: TransactionClient) => Promise<unknown>) => callback(transaction)), updateRecoveryEmailSent: jest.fn(), updateRecoveryStatus: jest.fn(), updateSettings: jest.fn() };
  return { repository, service: new AbandonedCartsService(repository as unknown as AbandonedCartsRepository), transaction };
}

function makeSession(overrides: Partial<AbandonedCartSessionRecord> = {}): AbandonedCartSessionRecord {
  return { abandonedAt: new Date("2026-09-03T10:00:00.000Z"), cartId: "cart-1", completedAt: null, createdAt: new Date("2026-09-01T10:00:00.000Z"), expiresAt: null, history: [], id: "session-1", lastActivityAt: new Date("2026-09-03T10:00:00.000Z"), lastEmailSentAt: null, recoveryExpiresAt: null, recoveryStatus: CheckoutRecoveryStatus.PENDING, recoveryTokenHash: null, snapshotData: { currency: "ARS", customer: { email: "customer@example.com", firstName: "Test", lastName: "Customer" }, items: [{ lineSubtotal: 125, name: "Whey", productId: "product-1", quantity: 1, unitPrice: 125 }], subtotal: 125, total: 125 }, status: CheckoutSessionStatus.ABANDONED, tokenHash: "session-hash", updatedAt: new Date("2026-09-03T10:00:00.000Z"), userId: null, user: null, order: null, cart: { id: "cart-1", status: "ABANDONED", userId: null, createdAt: new Date(), updatedAt: new Date(), user: null, items: [] }, ...overrides } as unknown as AbandonedCartSessionRecord;
}

function makeSettings(): Prisma.CartRecoverySettingsGetPayload<Record<string, never>> { return { id: "singleton", isActive: true, timing: "24hs", emailSubject: "Saved cart", emailHtmlBody: "<p>Saved</p>", emailPlainBody: "Saved", createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z") }; }
