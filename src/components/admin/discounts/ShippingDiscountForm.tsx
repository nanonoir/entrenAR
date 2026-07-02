"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormProvider, useForm, type FieldErrors } from "react-hook-form";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormActions } from "@/components/admin/form-actions/FormActions";
import { ShippingConditionsSection, ShippingMethodsSection } from "@/components/admin/discounts/ShippingConditionsSection";
import { ShippingScopeSection } from "@/components/admin/discounts/ShippingScopeSection";
import type { DiscountSelectOption, ShippingDiscount } from "@/lib/data/admin/discounts/types";
import { shippingDiscountSchema, type ShippingDiscountFormInput, type ShippingDiscountFormValues } from "@/schemas/admin/discount-schemas";
import { useAdminDiscountsStore } from "@/stores/admin-discounts-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";

type ShippingDiscountFormProps = {
  categoryOptions: DiscountSelectOption[];
  interceptNavigation: (href: string) => void;
  mode: "create" | "edit";
  onDirtyChange?: (isDirty: boolean) => void;
  shippingDiscount?: ShippingDiscount;
  shippingMethodOptions: DiscountSelectOption[];
  zoneOptions: DiscountSelectOption[];
};

function shippingDiscountDefaults(shippingDiscount?: ShippingDiscount): ShippingDiscountFormInput {
  return {
    shippingMethodIds: shippingDiscount?.shippingMethodIds ?? [],
    onlyCheapestShippingMethod: shippingDiscount?.onlyCheapestShippingMethod ?? false,
    targetType: shippingDiscount?.targetType ?? "all_store",
    categoryIds: shippingDiscount?.categoryIds ?? [],
    canCombineWithPromotions: shippingDiscount?.canCombineWithPromotions ?? true,
    zoneTargetType: shippingDiscount?.zoneTargetType ?? "all",
    zoneIds: shippingDiscount?.zoneIds ?? [],
    minimumCartAmount: shippingDiscount?.minimumCartAmount ?? 0,
    status: shippingDiscount?.status ?? "active",
  };
}

export function ShippingDiscountForm({ categoryOptions, interceptNavigation, mode, onDirtyChange, shippingDiscount, shippingMethodOptions, zoneOptions }: ShippingDiscountFormProps) {
  const router = useRouter();
  const createShippingDiscount = useAdminDiscountsStore((state) => state.createShippingDiscount);
  const updateShippingDiscount = useAdminDiscountsStore((state) => state.updateShippingDiscount);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<ShippingDiscountFormInput, unknown, ShippingDiscountFormValues>({ resolver: zodResolver(shippingDiscountSchema), defaultValues: shippingDiscountDefaults(shippingDiscount), mode: "onBlur" });
  const { formState: { isDirty, isSubmitting }, handleSubmit, reset } = form;
  const cancelHref = mode === "edit" && shippingDiscount ? `/admin/descuentos/envio-gratis/${shippingDiscount.id}` : "/admin/descuentos/envio-gratis";

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const onSubmit = useCallback((values: ShippingDiscountFormValues) => {
    setSubmitError(null);
    if (mode === "create") {
      const created = createShippingDiscount(values);
      addToast("Envío gratis creado correctamente.");
      router.push(`/admin/descuentos/envio-gratis/${created.id}`);
      return;
    }
    if (!shippingDiscount) return;
    updateShippingDiscount(shippingDiscount.id, values);
    reset(values);
    addToast("Envío gratis actualizado correctamente.");
  }, [addToast, createShippingDiscount, mode, reset, router, shippingDiscount, updateShippingDiscount]);

  const onInvalid = useCallback((formErrors: FieldErrors<ShippingDiscountFormInput>) => {
    setSubmitError("Debes completar todos los campos obligatorios correctamente.");
    const firstSection = formErrors.shippingMethodIds ? "shipping-methods-section" : formErrors.categoryIds ? "shipping-scope-section" : "shipping-conditions-section";
    document.getElementById(firstSection)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <FormProvider {...form}>
      <form className="grid min-w-0 gap-5" noValidate onSubmit={handleSubmit(onSubmit, onInvalid)}>
        {submitError ? <div role="alert" className="flex items-center gap-2 rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale"><AlertTriangle aria-hidden size={16} />{submitError}</div> : null}
        <ShippingMethodsSection shippingMethodOptions={shippingMethodOptions} />
        <ShippingScopeSection categoryOptions={categoryOptions} />
        <ShippingConditionsSection zoneOptions={zoneOptions} />
        <FormActions>
          <Button type="button" variant="secondary" onClick={() => interceptNavigation(cancelHref)}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting || (mode === "edit" && !isDirty)}>{isSubmitting ? <><Loader2 aria-hidden className="animate-spin" size={16} />Guardando…</> : mode === "create" ? "Crear" : "Guardar"}</Button>
        </FormActions>
      </form>
    </FormProvider>
  );
}
