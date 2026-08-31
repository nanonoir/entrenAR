import {
  CouponHistoryAction,
  CouponStatus,
  ShippingDiscountTargetType,
  ShippingZoneTargetType,
} from "../src/generated/prisma/enums";
import {
  couponInput,
  shippingDiscountInput,
} from "./commerce.e2e-fixtures";
import {
  assertNoSensitiveKeys,
  expectJson,
  expectSafeError,
  json,
  sensitiveValues,
  type CommerceE2eTestContext,
  type CouponResponse,
  type ShippingDiscountResponse,
} from "./commerce.e2e-support";

export function registerCommerceDiscountScenarios(context: CommerceE2eTestContext): void {
  it("completes coupon creation, history, archive, and deleted-code reuse with safe actor boundaries", async () => {
    await context.withFixtures(async (fixture) => {
      const database = context.prismaOrThrow();
      const secrets = sensitiveValues(fixture);
      const code = `e2e-${fixture.suffix}`;
      const createResponse = await context.request("/admin/discounts/coupons", {
        body: couponInput(code, { discountType: "free_shipping", includeShippingCost: true }),
        method: "POST",
        token: fixture.adminToken,
      });
      expect(createResponse.status).toBe(201);
      const created = await json<CouponResponse>(createResponse);
      fixture.couponIds.push(created.id);
      expect(created).toEqual(expect.objectContaining({
        code: code.toUpperCase(),
        discountType: "free_shipping",
        history: [expect.objectContaining({ action: "created", userName: "Commerce Admin" })],
        status: "active",
      }));
      assertNoSensitiveKeys(created);

      await expect(database.coupon.findUniqueOrThrow({ include: { history: true }, where: { id: created.id } })).resolves.toEqual(
        expect.objectContaining({
          code: code.toUpperCase(),
          history: [expect.objectContaining({
            action: CouponHistoryAction.CREATED,
            actorId: fixture.admin.id,
            actorName: "Commerce Admin",
          })],
          status: CouponStatus.ACTIVE,
        }),
      );

      const updateResponse = await context.request(`/admin/discounts/coupons/${created.id}`, {
        body: couponInput(code, { discountType: "percentage", discountValue: 25, status: "inactive" }),
        method: "PUT",
        token: fixture.adminToken,
      });
      expect(updateResponse.status).toBe(200);
      const updated = await json<CouponResponse>(updateResponse);
      expect(updated).toEqual(expect.objectContaining({
        discountType: "percentage",
        discountValue: 25,
        history: expect.arrayContaining([
          expect.objectContaining({ action: "created", userName: "Commerce Admin" }),
          expect.objectContaining({ action: "deactivated", userName: "Commerce Admin" }),
        ]),
        id: created.id,
        status: "inactive",
      }));
      expect(updated.history).toHaveLength(2);
      assertNoSensitiveKeys(updated);

      await expect(database.couponHistory.findMany({ orderBy: { createdAt: "asc" }, where: { couponId: created.id } })).resolves.toEqual([
        expect.objectContaining({ action: CouponHistoryAction.CREATED, actorId: fixture.admin.id, actorName: "Commerce Admin" }),
        expect.objectContaining({ action: CouponHistoryAction.DEACTIVATED, actorId: fixture.admin.id, actorName: "Commerce Admin" }),
      ]);

      const countBeforeInvalid = await database.coupon.count({ where: { deletedAt: null } });
      await expectSafeError(
        await context.request("/admin/discounts/coupons", {
          body: couponInput(`actor-${fixture.suffix}`, { actorId: fixture.customer.id, userId: fixture.customer.id }),
          method: "POST",
          token: fixture.adminToken,
        }),
        400,
        "VALIDATION_ERROR",
        secrets,
      );
      await expectSafeError(
        await context.request("/admin/discounts/coupons", {
          body: couponInput(`invalid-${fixture.suffix}`, { discountValue: 0 }),
          method: "POST",
          token: fixture.adminToken,
        }),
        400,
        "VALIDATION_ERROR",
        secrets,
      );
      await expect(database.coupon.count({ where: { deletedAt: null } })).resolves.toBe(countBeforeInvalid);

      await expectSafeError(
        await context.request("/admin/discounts/coupons", {
          body: couponInput(code, { discountValue: 10 }),
          method: "POST",
          token: fixture.adminToken,
        }),
        409,
        "COUPON_CODE_ALREADY_EXISTS",
        secrets,
      );
      await expect(database.coupon.count({ where: { code: code.toUpperCase(), deletedAt: null } })).resolves.toBe(1);

      await expectSafeError(
        await context.request(`/admin/discounts/coupons/missing-${fixture.suffix}`, {
          body: couponInput(`missing-${fixture.suffix}`),
          method: "PUT",
          token: fixture.adminToken,
        }),
        404,
        "NOT_FOUND",
        secrets,
      );

      const deleteResponse = await context.request(`/admin/discounts/coupons/${created.id}`, {
        method: "DELETE",
        token: fixture.adminToken,
      });
      expect(deleteResponse.status).toBe(200);
      await expectJson(deleteResponse, { ok: true });
      await expect(database.coupon.findUniqueOrThrow({ where: { id: created.id } })).resolves.toEqual(
        expect.objectContaining({ deletedAt: expect.any(Date), status: CouponStatus.INACTIVE }),
      );
      const afterDeleteResponse = await context.request("/admin/discounts/coupons", { token: fixture.adminToken });
      expect(afterDeleteResponse.status).toBe(200);
      const afterDelete = await json<CouponResponse[]>(afterDeleteResponse);
      expect(afterDelete.some((coupon) => coupon.id === created.id)).toBe(false);

      const reuseResponse = await context.request("/admin/discounts/coupons", {
        body: couponInput(code, { discountValue: 15 }),
        method: "POST",
        token: fixture.adminToken,
      });
      expect(reuseResponse.status).toBe(201);
      const reused = await json<CouponResponse>(reuseResponse);
      fixture.couponIds.push(reused.id);
      expect(reused).toEqual(expect.objectContaining({ code: code.toUpperCase(), status: "active" }));
      expect(reused.id).not.toBe(created.id);
      await expect(database.coupon.count({ where: { code: code.toUpperCase(), deletedAt: null } })).resolves.toBe(1);
      await expect(database.couponHistory.count({ where: { couponId: created.id } })).resolves.toBe(2);
    });
  });

  it("completes shipping-discount creation, update, archive, and validation boundaries", async () => {
    await context.withFixtures(async (fixture) => {
      const database = context.prismaOrThrow();
      const secrets = sensitiveValues(fixture);
      const createInput = shippingDiscountInput({
        categoryIds: ["cat-supplements"],
        targetType: "categories",
        zoneIds: ["ar-caba"],
        zoneTargetType: "specific",
      });
      const createResponse = await context.request("/admin/discounts/shipping", {
        body: createInput,
        method: "POST",
        token: fixture.adminToken,
      });
      expect(createResponse.status).toBe(201);
      const created = await json<ShippingDiscountResponse>(createResponse);
      fixture.shippingDiscountIds.push(created.id);
      expect(created).toEqual(expect.objectContaining({
        categoryIds: ["cat-supplements"],
        shippingMethodIds: ["andreani:envío-a-domicilio"],
        status: "active",
        targetType: "categories",
        zoneIds: ["ar-caba"],
        zoneTargetType: "specific",
      }));
      assertNoSensitiveKeys(created);
      await expect(database.shippingDiscountCategory.findMany({ where: { shippingDiscountId: created.id } })).resolves.toEqual([
        expect.objectContaining({ categoryId: "cat-supplements", shippingDiscountId: created.id }),
      ]);

      const listResponse = await context.request("/admin/discounts/shipping", { token: fixture.adminToken });
      expect(listResponse.status).toBe(200);
      const listed = await json<ShippingDiscountResponse[]>(listResponse);
      expect(listed).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id })]));
      assertNoSensitiveKeys(listed);

      const updateResponse = await context.request(`/admin/discounts/shipping/${created.id}`, {
        body: shippingDiscountInput({ status: "inactive" }),
        method: "PUT",
        token: fixture.adminToken,
      });
      expect(updateResponse.status).toBe(200);
      const updated = await json<ShippingDiscountResponse>(updateResponse);
      expect(updated).toEqual(expect.objectContaining({
        categoryIds: [],
        id: created.id,
        status: "inactive",
        targetType: "all_store",
        zoneIds: [],
        zoneTargetType: "all",
      }));
      await expect(database.shippingDiscount.findUniqueOrThrow({ include: { categories: true }, where: { id: created.id } })).resolves.toEqual(
        expect.objectContaining({
          categories: [],
          status: CouponStatus.INACTIVE,
          targetType: ShippingDiscountTargetType.ALL_STORE,
          zoneTargetType: ShippingZoneTargetType.ALL,
        }),
      );

      const beforeInvalidUpdate = await database.shippingDiscount.findUniqueOrThrow({ include: { categories: true }, where: { id: created.id } });
      await expectSafeError(
        await context.request(`/admin/discounts/shipping/${created.id}`, {
          body: shippingDiscountInput({ categoryIds: [], targetType: "categories" }),
          method: "PUT",
          token: fixture.adminToken,
        }),
        400,
        "VALIDATION_ERROR",
        secrets,
      );
      await expect(database.shippingDiscount.findUniqueOrThrow({ include: { categories: true }, where: { id: created.id } })).resolves.toEqual(beforeInvalidUpdate);

      const countBeforeInvalidCreate = await database.shippingDiscount.count({ where: { deletedAt: null } });
      await expectSafeError(
        await context.request("/admin/discounts/shipping", {
          body: shippingDiscountInput({ shippingMethodIds: ["unknown-provider:unknown-method"] }),
          method: "POST",
          token: fixture.adminToken,
        }),
        400,
        "VALIDATION_ERROR",
        secrets,
      );
      await expect(database.shippingDiscount.count({ where: { deletedAt: null } })).resolves.toBe(countBeforeInvalidCreate);

      await expectSafeError(
        await context.request(`/admin/discounts/shipping/missing-${fixture.suffix}`, {
          body: shippingDiscountInput(),
          method: "PUT",
          token: fixture.adminToken,
        }),
        404,
        "NOT_FOUND",
        secrets,
      );

      const deleteResponse = await context.request(`/admin/discounts/shipping/${created.id}`, {
        method: "DELETE",
        token: fixture.adminToken,
      });
      expect(deleteResponse.status).toBe(200);
      await expectJson(deleteResponse, { ok: true });
      await expect(database.shippingDiscount.findUniqueOrThrow({ where: { id: created.id } })).resolves.toEqual(
        expect.objectContaining({ deletedAt: expect.any(Date), status: CouponStatus.INACTIVE }),
      );
      const afterDeleteResponse = await context.request("/admin/discounts/shipping", { token: fixture.adminToken });
      expect(afterDeleteResponse.status).toBe(200);
      const afterDelete = await json<ShippingDiscountResponse[]>(afterDeleteResponse);
      expect(afterDelete.some((discount) => discount.id === created.id)).toBe(false);
    });
  });
}
