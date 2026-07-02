import { Minus, Plus, X } from "lucide-react";
import type { FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { OrderFormInput } from "@/schemas/admin/order-schema";
import { formatARS } from "@/lib/data/admin/sales-flow/helpers";
import { cn } from "@/lib/utils";
import { safeFormNumber, sanitizeDecimal } from "@/components/admin/sales-flow/order-form/order-form-utils";

type ProductLineItemProps = {
  fieldId: string;
  index: number;
  name: string;
  quantity: number;
  unitPrice: unknown;
  register: UseFormRegister<OrderFormInput>;
  setValue: UseFormSetValue<OrderFormInput>;
  errors?: FieldErrors<OrderFormInput>["products"];
  onRemove: () => void;
};

export function ProductLineItem({ fieldId, index, name, quantity, unitPrice, register, setValue, errors, onRemove }: ProductLineItemProps) {
  const quantityError = Array.isArray(errors) ? errors[index]?.quantity?.message : undefined;
  const priceError = Array.isArray(errors) ? errors[index]?.unitPrice?.message : undefined;
  const lineTotal = (Number.isFinite(quantity) ? quantity : 1) * safeFormNumber(unitPrice);
  const unitPriceField = register(`products.${index}.unitPrice`);
  const quantityId = `${fieldId}-quantity`;
  const priceId = `${fieldId}-unit-price`;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(150px,auto)_minmax(160px,auto)_1fr] sm:items-start">
          <div className="grid gap-1.5">
            <label htmlFor={quantityId} className="text-xs font-medium text-zinc-700">Cantidad</label>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Reducir cantidad" onClick={() => quantity > 1 && setValue(`products.${index}.quantity`, quantity - 1, { shouldDirty: true, shouldValidate: true })} className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 transition hover:bg-zinc-100">
                <Minus aria-hidden size={12} />
              </button>
              <input id={quantityId} type="number" min={1} aria-describedby={quantityError ? `${quantityId}-error` : `${quantityId}-helper`} aria-invalid={quantityError ? true : undefined} {...register(`products.${index}.quantity`, { valueAsNumber: true })} className={cn("h-8 w-14 rounded-lg border border-zinc-200 bg-zinc-50 text-center text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm", quantityError && "border-sale focus:border-sale focus:ring-sale/20")} />
              <button type="button" aria-label="Aumentar cantidad" onClick={() => setValue(`products.${index}.quantity`, quantity + 1, { shouldDirty: true, shouldValidate: true })} className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 transition hover:bg-zinc-100">
                <Plus aria-hidden size={12} />
              </button>
            </div>
            {quantityError ? <span id={`${quantityId}-error`} className="text-xs font-medium text-sale">{quantityError}</span> : <span id={`${quantityId}-helper`} className="text-xs text-zinc-500">Mínimo 1 unidad</span>}
          </div>

          <div className="grid gap-1.5">
            <label htmlFor={priceId} className="text-xs font-medium text-zinc-700">Precio unitario</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-400">$</span>
              <input id={priceId} type="text" inputMode="decimal" aria-describedby={priceError ? `${priceId}-error` : `${priceId}-helper`} aria-invalid={priceError ? true : undefined} {...unitPriceField} onChange={(event) => setValue(`products.${index}.unitPrice`, sanitizeDecimal(event.currentTarget.value), { shouldDirty: true, shouldValidate: true })} className={cn("h-8 w-28 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm", priceError && "border-sale focus:border-sale focus:ring-sale/20")} />
            </div>
            {priceError ? <span id={`${priceId}-error`} className="text-xs font-medium text-sale">{priceError}</span> : <span id={`${priceId}-helper`} className="text-xs text-zinc-500">Usá punto o coma decimal</span>}
          </div>

          <span className="self-center text-sm font-semibold text-zinc-700 sm:justify-self-end">{formatARS(lineTotal)}</span>
        </div>
      </div>
      <button type="button" aria-label={`Eliminar ${name}`} onClick={onRemove} className="mt-1 shrink-0 rounded-full p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-600">
        <X aria-hidden size={16} />
      </button>
    </div>
  );
}
