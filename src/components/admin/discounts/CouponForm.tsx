"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormActions } from "@/components/admin/form-actions/FormActions";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
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
  const createCoupon = useAdminDiscountsStore((state) => state.createCoupon);
  const updateCoupon = useAdminDiscountsStore((state) => state.updateCoupon);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const schema = useMemo(() => createCouponSchema(coupons.map((item) => item.code), coupon?.code), [coupon?.code, coupons]);
  const form = useForm<CouponFormInput, unknown, CouponFormValues>({ resolver: zodResolver(schema), defaultValues: couponDefaults(coupon), mode: "onBlur" });
  const { formState: { errors, isDirty, isSubmitting }, handleSubmit, register, reset, setFocus, setValue } = form;
  const cancelHref = mode === "edit" && coupon ? `/admin/descuentos/cupones/${coupon.id}` : "/admin/descuentos/cupones";

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const onSubmit = useCallback((values: CouponFormValues) => {
    setSubmitError(null);
    if (mode === "create") {
      const created = createCoupon(values);
      addToast("Cupón creado correctamente.");
      router.push(`/admin/descuentos/cupones/${created.id}`);
      return;
    }
    if (!coupon) return;
    updateCoupon(coupon.id, values);
    reset(values);
    addToast("Cupón actualizado correctamente.");
  }, [addToast, coupon, createCoupon, mode, reset, router, updateCoupon]);

  const onInvalid = useCallback((formErrors: typeof errors) => {
    setSubmitError("Debes completar todos los campos obligatorios correctamente.");
    if (formErrors.code) {
      scrollToFirstError(formErrors, ["coupon-code-section"]);
      setFocus("code");
      return;
    }
    const firstSection = formErrors.discountValue ? "coupon-type-section" : formErrors.categoryIds || formErrors.productIds ? "coupon-scope-section" : "coupon-limits-section";
    scrollToFirstError(formErrors, [firstSection]);
  }, [setFocus]);

  return (
    <FormProvider {...form}>
      <form className="grid min-w-0 gap-5" noValidate onSubmit={handleSubmit(onSubmit, onInvalid)}>
        {submitError ? <div role="alert" className="flex items-center gap-2 rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale"><AlertTriangle aria-hidden size={16} />{submitError}</div> : null}
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
