import { ChevronDown } from "lucide-react";
import type { FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import type { OrderFormInput } from "@/schemas/admin/order-schema";
import { cn } from "@/lib/utils";
import { sanitizeAddress, sanitizeName, setSanitizedFormValue } from "@/components/admin/sales-flow/order-form/order-form-utils";

type ShippingSectionProps = {
  open: boolean;
  onToggle: () => void;
  register: UseFormRegister<OrderFormInput>;
  setValue: UseFormSetValue<OrderFormInput>;
  errors: FieldErrors<OrderFormInput>;
};

export function ShippingSection({ open, onToggle, register, setValue, errors }: ShippingSectionProps) {
  return (
    <section id="shipping-section" className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={open}>
        <h2 className="text-base font-semibold text-zinc-950">Dirección de envío <span className="text-xs font-normal text-zinc-400">(opcional)</span></h2>
        <ChevronDown aria-hidden size={18} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input id="shippingStreet" label="Calle" helperText="Opcional; se valida sólo si abrís esta sección" {...register("shippingStreet")} onChange={(event) => setSanitizedFormValue(setValue, "shippingStreet", event.currentTarget.value, sanitizeAddress)} errorText={errors.shippingStreet?.message} />
          <Input id="shippingNumber" label="Número" helperText="Altura del domicilio" {...register("shippingNumber")} onChange={(event) => setSanitizedFormValue(setValue, "shippingNumber", event.currentTarget.value, sanitizeAddress)} errorText={errors.shippingNumber?.message} />
          <Input id="shippingFloor" label="Piso" helperText="Opcional" {...register("shippingFloor")} onChange={(event) => setSanitizedFormValue(setValue, "shippingFloor", event.currentTarget.value, sanitizeAddress)} errorText={errors.shippingFloor?.message} />
          <Input id="shippingUnit" label="Departamento" helperText="Opcional" {...register("shippingUnit")} onChange={(event) => setSanitizedFormValue(setValue, "shippingUnit", event.currentTarget.value, sanitizeAddress)} errorText={errors.shippingUnit?.message} />
          <Input id="shippingCity" label="Ciudad" helperText="Localidad de entrega" {...register("shippingCity")} onChange={(event) => setSanitizedFormValue(setValue, "shippingCity", event.currentTarget.value, sanitizeName)} errorText={errors.shippingCity?.message} />
          <Input id="shippingProvince" label="Provincia" helperText="Provincia de entrega" {...register("shippingProvince")} onChange={(event) => setSanitizedFormValue(setValue, "shippingProvince", event.currentTarget.value, sanitizeName)} errorText={errors.shippingProvince?.message} />
          <Input id="shippingPostalCode" label="Código postal" helperText="Código postal argentino" {...register("shippingPostalCode")} onChange={(event) => setSanitizedFormValue(setValue, "shippingPostalCode", event.currentTarget.value, sanitizeAddress)} errorText={errors.shippingPostalCode?.message} />
          <Input id="shippingNotes" label="Indicaciones adicionales" helperText="Ej: timbre 2B, portero eléctrico" {...register("shippingNotes")} errorText={errors.shippingNotes?.message} />
        </div>
      )}
    </section>
  );
}
