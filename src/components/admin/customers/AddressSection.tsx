import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/Input";
import type { CustomerFormInput } from "@/schemas/admin/customer-schema";
import { cn } from "@/lib/utils";

type AddressSectionProps = {
  open: boolean;
  mode: "create" | "edit";
  onToggle: () => void;
  register: UseFormRegister<CustomerFormInput>;
  errors: FieldErrors<CustomerFormInput>;
};

export function AddressSection({ errors, mode, onToggle, open, register }: AddressSectionProps) {
  return (
    <section id="customer-address-section" className="rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Datos de envío</h2>
          <p className="mt-1 text-sm text-zinc-500">Opcional. Si completás un dato, se exige la dirección mínima.</p>
        </div>
        <ChevronDown aria-hidden className={cn("shrink-0 transition", open && "rotate-180")} size={18} />
      </button>
      {open ? (
        <div className="grid gap-4 border-t border-zinc-100 p-5 sm:grid-cols-2">
          <Input id="street" label="Calle" helperText="Nombre de la calle." {...register("street")} errorText={errors.street?.message} />
          <Input id="number" label="Número" helperText="Altura del domicilio." {...register("number")} errorText={errors.number?.message} />
          <Input id="floorOrApartment" label="Piso/Dpto." helperText="Opcional." {...register("floorOrApartment")} errorText={errors.floorOrApartment?.message} />
          <Input id="postalCode" label="Código postal" helperText="Ej: 1425" {...register("postalCode")} errorText={errors.postalCode?.message} />
          <Input id="neighborhood" label="Barrio" helperText="Opcional." {...register("neighborhood")} errorText={errors.neighborhood?.message} />
          <Input id="city" label="Ciudad" helperText="Localidad de entrega." {...register("city")} errorText={errors.city?.message} />
          <Input id="provinceOrState" label="Provincia / Estado" helperText="Provincia o estado." {...register("provinceOrState")} errorText={errors.provinceOrState?.message} />
          <label className="grid gap-2 text-sm font-medium text-text" htmlFor="country">
            <span>País</span>
            <select id="country" aria-describedby={errors.country ? "country-error" : "country-helper"} aria-invalid={errors.country ? true : undefined} className={cn("h-11 w-full rounded-button border border-border bg-surface px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm", errors.country && "border-sale focus:border-sale focus:ring-sale/20")} {...register("country")}>
              <option value="Argentina">Argentina</option>
              <option value="Uruguay">Uruguay</option>
              <option value="Chile">Chile</option>
            </select>
            {errors.country?.message ? <span id="country-error" className="text-xs font-medium text-sale">{errors.country.message}</span> : <span id="country-helper" className="text-xs text-text-muted">Valor inicial: Argentina.</span>}
          </label>
          {mode === "edit" ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:col-span-2">En caso de modificación, la nueva dirección se usará solo en nuevos pedidos. Las ventas anteriores conservarán la dirección registrada al momento de la compra.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
