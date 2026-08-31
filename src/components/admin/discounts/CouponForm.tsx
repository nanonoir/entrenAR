"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormProvider, useForm, type FieldPath } from "react-hook-form";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormActions } from "@/components/admin/form-actions/FormActions";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
import { applyCommerceFieldIssues, focusFirstCommerceError } from "@/components/admin/ui/CommerceFieldIssues";
import { CouponLimitsSection } from "@/components/admin/discounts/CouponLimitsSection";
import { CouponScopeSection } from "@/components/admin/discounts/CouponScopeSection";
import { CouponTypeSection } from "@/components/admin/discounts/CouponTypeSection";
import { FormCard } from "@/components/admin/discounts/coupon-form-controls";
import type { Coupon, DiscountSelectOption } from "@/lib/data/admin/discounts/types";
import { createCouponSchema, normalizeCouponCode, type CouponFormInput, type CouponFormValues } from "@/schemas/admin/discount-schemas";
import { useAdminDiscountsStore } from "@/stores/admin-discounts-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";

type CouponFormProps = {
  categoryOptions: DiscountSelectOption[];
  coupon?: Coupon;
  interceptNavigation: (href: string) => void;
  mode: "create" | "edit";
  onDirtyChange?: (isDirty: boolean) => void;
  productOptions: DiscountSelectOption[];
};

function couponDefaults(coupon?: Coupon): CouponFormInput {
  return {
    code: coupon?.code ?? "",
    discountType: coupon?.discountType ?? "percentage",
    discountValue: coupon?.discountValue,
    includeShippingCost: coupon?.includeShippingCost ?? false,
    targetType: coupon?.targetType ?? "all_store",
    categoryIds: coupon?.categoryIds ?? [],
    productIds: coupon?.productIds ?? [],
    canCombineWithPromotions: coupon?.canCombineWithPromotions ?? true,
    totalUsageLimitType: coupon?.totalUsageLimitType ?? "unlimited",
    totalUsageLimit: coupon?.totalUsageLimit,
    customerLimitType: coupon?.customerLimitType ?? "unlimited",
    customerUsageLimit: coupon?.customerUsageLimit,
    dateLimitType: coupon?.dateLimitType ?? "unlimited",
    startDate: coupon?.startDate,
    endDate: coupon?.endDate,
    minimumCartAmount: coupon?.minimumCartAmount ?? 0,
    maxDiscountType: coupon?.maxDiscountType ?? "none",
    maxDiscountAmount: coupon?.maxDiscountAmount,
    status: coupon?.status ?? "active",
  };
}

export function CouponForm({ categoryOptions, coupon, interceptNavigation, mode, onDirtyChange, productOptions }: CouponFormProps) {
  const router = useRouter();
  const coupons = useAdminDiscountsStore((state) => state.coupons);
  const createCouponAsync = useAdminDiscountsStore((state) => state.createCouponAsync);
  const updateCoupon = useAdminDiscountsStore((state) => state.updateCoupon);
  const clearError = useAdminDiscountsStore((state) => state.clearError);
  const apiError = useAdminDiscountsStore((state) => state.error);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const schema = createCouponSchema(coupons.map((item) => item.code), coupon?.code);
  const form = useForm<CouponFormInput, unknown, CouponFormValues>({ resolver: zodResolver(schema), defaultValues: couponDefaults(coupon), mode: "onBlur" });
  const { formState: { errors, isDirty, isSubmitting }, handleSubmit, register, reset, setError, setFocus, setValue } = form;
  const cancelHref = mode === "edit" && coupon ? `/admin/descuentos/cupones/${coupon.id}` : "/admin/descuentos/cupones";

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!apiError) return;

    const firstField = applyCommerceFieldIssues(apiError.issues, resolveCouponField, setError);
    if (!firstField) return;

    const frame = window.requestAnimationFrame(focusFirstCommerceError);
    return () => window.cancelAnimationFrame(frame);
  }, [apiError, setError]);

  async function onSubmit(values: CouponFormValues) {
    setSubmitError(null);
    clearError();
    if (mode === "create") {
      const created = await createCouponAsync(values);
      if (!created) return;

      addToast("Cupón creado correctamente.");
      router.push(`/admin/descuentos/cupones/${created.id}`);
      return;
    }
    if (!coupon) return;
    const updated = await updateCoupon(coupon.id, values);
    if (!updated) return;

    reset(values);
    addToast("Cupón actualizado correctamente.");
  }

  function onInvalid(formErrors: typeof errors) {
    setSubmitError("Debes completar todos los campos obligatorios correctamente.");
    if (formErrors.code) {
      scrollToFirstError(formErrors, ["coupon-code-section"]);
      setFocus("code");
      return;
    }
    const firstSection = formErrors.discountValue ? "coupon-type-section" : formErrors.categoryIds || formErrors.productIds ? "coupon-scope-section" : "coupon-limits-section";
    scrollToFirstError(formErrors, [firstSection]);
  }

  return (
    <FormProvider {...form}>
      <form className="grid min-w-0 gap-5" noValidate onSubmit={handleSubmit(onSubmit, onInvalid)}>
        {submitError || apiError ? <div role="alert" className="flex items-center gap-2 rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale"><AlertTriangle aria-hidden size={16} />{submitError ?? apiError?.message}</div> : null}
        <FormCard id="coupon-code-section" title="Código del cupón" description="Este es el código que tu cliente deberá ingresar en el momento de la compra.">
          <Input id="coupon-code" label="Código del cupón" helperText={errors.code ? undefined : "Usá letras, números y guiones. Se transformará automáticamente a mayúsculas."} errorText={errors.code?.message} {...register("code", { onChange: (event) => setValue("code", normalizeCouponCode(event.currentTarget.value), { shouldDirty: true, shouldValidate: false }) })} />
        </FormCard>
        <CouponTypeSection />
        <CouponScopeSection categoryOptions={categoryOptions} productOptions={productOptions} />
        <CouponLimitsSection />
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => interceptNavigation(cancelHref)}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting || (mode === "edit" && !isDirty)}>{isSubmitting ? <><Loader2 aria-hidden className="animate-spin" size={16} />Guardando…</> : mode === "create" ? "Crear" : "Guardar"}</Button>
        </FormActions>
      </form>
    </FormProvider>
  );
}

const COUPON_FIELD = {
  CAN_COMBINE: "canCombineWithPromotions",
  CATEGORY_IDS: "categoryIds",
  CODE: "code",
  CUSTOMER_LIMIT_TYPE: "customerLimitType",
  CUSTOMER_USAGE_LIMIT: "customerUsageLimit",
  DATE_LIMIT_TYPE: "dateLimitType",
  DISCOUNT_TYPE: "discountType",
  DISCOUNT_VALUE: "discountValue",
  END_DATE: "endDate",
  INCLUDE_SHIPPING: "includeShippingCost",
  MAX_DISCOUNT_AMOUNT: "maxDiscountAmount",
  MAX_DISCOUNT_TYPE: "maxDiscountType",
  MINIMUM_CART_AMOUNT: "minimumCartAmount",
  PRODUCT_IDS: "productIds",
  START_DATE: "startDate",
  STATUS: "status",
  TARGET_TYPE: "targetType",
  TOTAL_USAGE_LIMIT: "totalUsageLimit",
  TOTAL_USAGE_LIMIT_TYPE: "totalUsageLimitType",
} as const;

type CouponField = (typeof COUPON_FIELD)[keyof typeof COUPON_FIELD];

function resolveCouponField(field: string): FieldPath<CouponFormInput> | undefined {
  return Object.values(COUPON_FIELD).includes(field as CouponField) ? field as CouponField : undefined;
}
