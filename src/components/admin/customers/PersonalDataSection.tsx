import type { FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import type { CustomerFormInput } from "@/schemas/admin/customer-schema";

function sanitizeName(value: string) {
  return value.replace(/[^\p{L}\s'’-]/gu, "");
}

function sanitizePhone(value: string) {
  return value.replace(/[^+\d\s()-]/g, "");
}

function sanitizeDni(value: string) {
  return value.replace(/[^\d-]/g, "");
}

function setSanitizedValue(setValue: UseFormSetValue<CustomerFormInput>, field: keyof CustomerFormInput, value: string, sanitizer: (value: string) => string) {
  setValue(field, sanitizer(value), { shouldDirty: true, shouldValidate: true });
}

type PersonalDataSectionProps = {
  register: UseFormRegister<CustomerFormInput>;
  setValue: UseFormSetValue<CustomerFormInput>;
  errors: FieldErrors<CustomerFormInput>;
};

export function PersonalDataSection({ errors, register, setValue }: PersonalDataSectionProps) {
  const fullNameRegister = register("fullName", {
    onChange: (event) => setSanitizedValue(setValue, "fullName", event.target.value, sanitizeName),
  });
  const phoneRegister = register("phone", {
    onChange: (event) => setSanitizedValue(setValue, "phone", event.target.value, sanitizePhone),
  });
  const dniOrCuilRegister = register("dniOrCuil", {
    onChange: (event) => setSanitizedValue(setValue, "dniOrCuil", event.target.value, sanitizeDni),
  });

  return (
    <section id="customer-personal-section" className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-zinc-950">Datos personales</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="fullName" label="Nombre y apellido *" helperText="Letras, espacios, apóstrofes o guiones." {...fullNameRegister} errorText={errors.fullName?.message} />
        <Input id="email" label="E-mail *" type="email" helperText="Debe ser único entre clientes activos." {...register("email")} errorText={errors.email?.message} />
        <Input id="phone" label="Teléfono" helperText="Ej: +54 11 4567-8901" {...phoneRegister} errorText={errors.phone?.message} />
        <Input id="dniOrCuil" label="DNI o CUIL" helperText="Puede repetirse; usá números y guiones." {...dniOrCuilRegister} errorText={errors.dniOrCuil?.message} />
      </div>
    </section>
  );
}
