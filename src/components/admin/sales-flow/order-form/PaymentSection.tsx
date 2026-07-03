import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import type { OrderFormInput } from "@/schemas/admin/order-schema";
import { cn } from "@/lib/utils";
import { sanitizeDecimal, setSanitizedFormValue } from "@/components/admin/sales-flow/order-form/order-form-utils";

const PAYMENT_OPTIONS = [
  { value: "unpaid", label: "Pago no realizado", description: "Crea una orden de compra pendiente de pago." },
  { value: "pending", label: "Pago pendiente", description: "El cliente declaró haber pagado, en confirmación." },
  { value: "received", label: "Pago recibido", description: "El pago fue confirmado y acreditado." },
] as const;

const DISCOUNT_TYPE_OPTIONS = [
  { value: "percentage", label: "% Porcentaje" },
  { value: "fixed", label: "$ Importe fijo" },
];

type PaymentSectionProps = {
  control: Control<OrderFormInput>;
  register: UseFormRegister<OrderFormInput>;
  setValue: UseFormSetValue<OrderFormInput>;
  errors: FieldErrors<OrderFormInput>;
  currentDiscountType?: "percentage" | "fixed";
};

export function PaymentSection({ control, register, setValue, errors, currentDiscountType }: PaymentSectionProps) {
  const paymentErrorId = errors.paymentOption ? "payment-option-error" : undefined;

  return (
    <section id="payment-section" className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-zinc-950">Pago</h2>

        <fieldset className="mb-5" aria-describedby={paymentErrorId} aria-invalid={errors.paymentOption ? true : undefined}>
        <legend className="mb-2 text-sm font-medium text-zinc-700">Estado del pago *</legend>
        {errors.paymentOption && <p id="payment-option-error" className="mb-2 text-xs font-medium text-sale">{errors.paymentOption.message}</p>}
        <Controller
          control={control}
          name="paymentOption"
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-3">
              {PAYMENT_OPTIONS.map((opt) => (
                <label key={opt.value} className={cn("flex cursor-pointer flex-col gap-1 rounded-2xl border p-3 text-sm transition", field.value === opt.value ? "border-accent bg-accent-soft text-accent-hover" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50", errors.paymentOption && "border-sale") }>
                  <input
                    ref={field.ref}
                    type="radio"
                    name={field.name}
                    className="sr-only"
                    value={opt.value}
                    checked={field.value === opt.value}
                    onBlur={field.onBlur}
                    onChange={() => field.onChange(opt.value)}
                    aria-describedby={paymentErrorId}
                  />
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-xs opacity-70">{opt.description}</span>
                </label>
              ))}
            </div>
          )}
        />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-text" htmlFor="discountType">
          <span>Tipo de descuento</span>
          <select id="discountType" {...register("discountType")} className="h-11 w-full rounded-button border border-border bg-surface px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm">
            <option value="">Sin descuento</option>
            {DISCOUNT_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <span className="text-xs text-text-muted">Opcional</span>
        </label>
        {currentDiscountType && (
          <Input id="discountValue" label={currentDiscountType === "percentage" ? "Descuento (%)" : "Descuento ($)"} helperText={currentDiscountType === "percentage" ? "Ej: 10 para 10%" : "Usá punto o coma como decimal"} trailingLabel={currentDiscountType === "percentage" ? "%" : undefined} {...register("discountValue")} onChange={(event) => setSanitizedFormValue(setValue, "discountValue", event.currentTarget.value, sanitizeDecimal)} errorText={errors.discountValue?.message} />
        )}
      </div>

      <div className="mt-4">
        <Input id="shippingCost" label="Costo de envío ($)" helperText="Ingresá 0 si el envío es sin cargo" trailingLabel="ARS" {...register("shippingCost")} onChange={(event) => setSanitizedFormValue(setValue, "shippingCost", event.currentTarget.value, sanitizeDecimal)} errorText={errors.shippingCost?.message} />
      </div>
    </section>
  );
}
