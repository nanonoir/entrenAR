"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Checkbox } from "@/components/ui/Checkbox";
import { CouponTextInput, FormCard, RadioPillGroup } from "@/components/admin/discounts/coupon-form-controls";
import type { CouponFormInput } from "@/schemas/admin/discount-schemas";

export function CouponLimitsSection() {
  const { register, setValue } = useFormContext<CouponFormInput>();
  const totalLimit = useWatch({ name: "totalUsageLimitType" });
  const customerLimit = useWatch({ name: "customerLimitType" });
  const dateLimit = useWatch({ name: "dateLimitType" });
  const maxDiscount = useWatch({ name: "maxDiscountType" });

  return (
    <FormCard id="coupon-limits-section" title="Límites de uso" description="Definí las condiciones de tu cupón.">
      <Checkbox id="coupon-combine" label="Permitir combinar con otras promociones. Ej.: precio promocional, envío gratis y otras." {...register("canCombineWithPromotions")} />
      <RadioPillGroup label="Por cupón" name="totalUsageLimitType" options={[{ label: "Ilimitado", value: "unlimited" }, { label: "Limitado", value: "limited" }]} onChange={(value) => { setValue("totalUsageLimitType", value as CouponFormInput["totalUsageLimitType"], { shouldDirty: true, shouldValidate: true }); if (value === "unlimited") setValue("totalUsageLimit", undefined, { shouldDirty: true, shouldValidate: true }); }} />
      {totalLimit === "limited" ? <CouponTextInput name="totalUsageLimit" label="¿Cuántas veces el cupón podrá ser usado?" helperText="Ingresá un número entero mayor a 0." type="number" inputMode="numeric" /> : null}
      <RadioPillGroup label="Por cliente" name="customerLimitType" options={[{ label: "Ilimitado", value: "unlimited" }, { label: "Limitado", value: "limited" }, { label: "Primera compra", value: "first_purchase" }]} onChange={(value) => { setValue("customerLimitType", value as CouponFormInput["customerLimitType"], { shouldDirty: true, shouldValidate: true }); if (value !== "limited") setValue("customerUsageLimit", undefined, { shouldDirty: true, shouldValidate: true }); }} />
      {customerLimit === "limited" ? <CouponTextInput name="customerUsageLimit" label="¿Cuántas veces cada cliente podrá usar el cupón?" helperText="Ingresá un número entero mayor a 0." type="number" inputMode="numeric" /> : null}
      <RadioPillGroup label="Fecha" name="dateLimitType" options={[{ label: "Ilimitado", value: "unlimited" }, { label: "Periodo", value: "period" }]} onChange={(value) => { setValue("dateLimitType", value as CouponFormInput["dateLimitType"], { shouldDirty: true, shouldValidate: true }); if (value === "unlimited") { setValue("startDate", undefined, { shouldDirty: true, shouldValidate: true }); setValue("endDate", undefined, { shouldDirty: true, shouldValidate: true }); } }} />
      {dateLimit === "period" ? <div className="grid gap-3 sm:grid-cols-2"><CouponTextInput name="startDate" label="Fecha de inicio" helperText="Inicio de vigencia." type="date" /><CouponTextInput name="endDate" label="Fecha de fin" helperText="Fin de vigencia." type="date" /></div> : null}
      <CouponTextInput name="minimumCartAmount" label="Monto del carrito mayor de" helperText="No aplica al costo de envío. Puede ser 0." type="number" inputMode="decimal" />
      <RadioPillGroup label="Tope máximo de descuento" name="maxDiscountType" options={[{ label: "Ninguno", value: "none" }, { label: "Hasta", value: "amount" }]} onChange={(value) => { setValue("maxDiscountType", value as CouponFormInput["maxDiscountType"], { shouldDirty: true, shouldValidate: true }); if (value === "none") setValue("maxDiscountAmount", undefined, { shouldDirty: true, shouldValidate: true }); }} />
      {maxDiscount === "amount" ? <CouponTextInput name="maxDiscountAmount" label="Tope máximo" helperText="Ingresá el monto máximo de descuento." type="number" inputMode="decimal" /> : null}
    </FormCard>
  );
}
