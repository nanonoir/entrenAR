"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import type { CouponFormInput } from "@/schemas/admin/discount-schemas";
import { FormCard, RadioPillGroup } from "@/components/admin/discounts/coupon-form-controls";

export function CouponTypeSection() {
  const { formState: { errors }, register, setValue } = useFormContext<CouponFormInput>();
  const discountType = useWatch({ name: "discountType" });

  return (
    <FormCard id="coupon-type-section" title="Tipo de descuento" description="Definí qué beneficio recibirá el cliente al usar el código.">
      <RadioPillGroup
        label="Tipo de descuento"
        name="discountType"
        options={[{ label: "Porcentaje", value: "percentage" }, { label: "Monto fijo", value: "fixed" }, { label: "Envío gratis", value: "free_shipping" }]}
        onChange={(value) => {
          setValue("discountType", value as CouponFormInput["discountType"], { shouldDirty: true, shouldValidate: true });
          if (value === "free_shipping") setValue("discountValue", undefined, { shouldDirty: true, shouldValidate: true });
        }}
      />
      {discountType === "percentage" ? (
        <Input id="coupon-percentage" label="¿Cuál es el porcentaje de descuento?" trailingLabel="%" type="number" inputMode="decimal" helperText="Debe ser mayor a 0 y no superar el 100%." errorText={errors.discountValue?.message} {...register("discountValue", { valueAsNumber: true })} />
      ) : null}
      {discountType === "fixed" ? (
        <Input id="coupon-fixed" label="Monto fijo" trailingLabel="$" type="number" inputMode="decimal" helperText="Ingresá el monto de descuento en pesos." errorText={errors.discountValue?.message} {...register("discountValue", { valueAsNumber: true })} />
      ) : null}
      {discountType === "free_shipping" ? <p className="rounded-2xl bg-accent-soft p-3 text-sm text-accent-hover">El cupón de envío gratis usa código y conserva las reglas generales de cupón. No solicita monto, porcentaje ni medios de envío.</p> : null}
      {discountType !== "free_shipping" ? <Checkbox id="include-shipping" label="Incluir el costo de envío en el descuento" {...register("includeShippingCost")} /> : null}
    </FormCard>
  );
}
