import type { FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import type { OrderFormInput } from "@/schemas/admin/order-schema";
import { sanitizeDigits, sanitizeName, sanitizePhone, setSanitizedFormValue } from "@/components/admin/sales-flow/order-form/order-form-utils";

type CustomerSectionProps = {
  register: UseFormRegister<OrderFormInput>;
  setValue: UseFormSetValue<OrderFormInput>;
  errors: FieldErrors<OrderFormInput>;
};

export function CustomerSection({ register, setValue, errors }: CustomerSectionProps) {
  return (
    <section id="customer-section" className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-zinc-950">Cliente</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="firstName" label="Nombre *" helperText="Al menos 2 caracteres" {...register("firstName")} onChange={(event) => setSanitizedFormValue(setValue, "firstName", event.currentTarget.value, sanitizeName)} errorText={errors.firstName?.message} />
        <Input id="lastName" label="Apellido *" helperText="Al menos 2 caracteres" {...register("lastName")} onChange={(event) => setSanitizedFormValue(setValue, "lastName", event.currentTarget.value, sanitizeName)} errorText={errors.lastName?.message} />
        <Input id="email" label="E-mail" type="email" helperText="Opcional" {...register("email")} errorText={errors.email?.message} />
        <Input id="phone" label="Teléfono" helperText="Ej: +54 11 4567-8901" {...register("phone")} onChange={(event) => setSanitizedFormValue(setValue, "phone", event.currentTarget.value, sanitizePhone)} errorText={errors.phone?.message} />
        <Input id="dniOrCuil" label="DNI / CUIL" helperText="7 a 11 dígitos, sin puntos ni guiones" {...register("dniOrCuil")} onChange={(event) => setSanitizedFormValue(setValue, "dniOrCuil", event.currentTarget.value, sanitizeDigits)} errorText={errors.dniOrCuil?.message} />
      </div>
    </section>
  );
}
