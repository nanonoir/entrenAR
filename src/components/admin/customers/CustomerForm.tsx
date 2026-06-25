"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { AddressSection } from "@/components/admin/customers/AddressSection";
import { PersonalDataSection } from "@/components/admin/customers/PersonalDataSection";
import type { Customer } from "@/lib/data/admin/customers/types";
import { customerFormSchema, type CustomerFormInput, type CustomerFormValues } from "@/schemas/admin/customer-schema";
import { useAdminCustomersStore } from "@/stores/admin-customers-store";

type CustomerFormProps = {
  customer?: Customer;
  mode: "create" | "edit";
};

function defaults(customer?: Customer): CustomerFormInput {
  return {
    fullName: customer?.fullName ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    dniOrCuil: customer?.dniOrCuil ?? "",
    street: customer?.address?.street ?? "",
    number: customer?.address?.number ?? "",
    floorOrApartment: customer?.address?.floorOrApartment ?? "",
    postalCode: customer?.address?.postalCode ?? "",
    neighborhood: customer?.address?.neighborhood ?? "",
    city: customer?.address?.city ?? "",
    provinceOrState: customer?.address?.provinceOrState ?? "",
    country: customer?.address?.country ?? "Argentina",
  };
}

export function CustomerForm({ customer, mode }: CustomerFormProps) {
  const router = useRouter();
  const createCustomer = useAdminCustomersStore((state) => state.createCustomer);
  const updateCustomer = useAdminCustomersStore((state) => state.updateCustomer);
  const [addressOpen, setAddressOpen] = useState(Boolean(customer?.address));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, setValue, setFocus, formState: { errors } } = useForm<CustomerFormInput, unknown, CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: defaults(customer),
    mode: "onBlur",
  });

  const onSubmit = useCallback((values: CustomerFormValues) => {
    setSubmitError(null);
    setIsSubmitting(true);
    const result = mode === "create" ? createCustomer(values) : customer ? updateCustomer(customer.id, values) : { ok: false as const, code: "CUSTOMER_NOT_FOUND" as const, message: "Cliente no encontrado." };
    setIsSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      if (result.code === "EMAIL_EXISTS") setFocus("email");
      return;
    }
    router.push(`/admin/clientes/${result.customerId}`);
  }, [createCustomer, customer, mode, router, setFocus, updateCustomer]);

  const handleInvalidSubmit = useCallback((formErrors: typeof errors) => {
    const hasPersonalErrors = Boolean(formErrors.fullName || formErrors.email || formErrors.phone || formErrors.dniOrCuil);
    const firstSectionId = hasPersonalErrors ? "customer-personal-section" : "customer-address-section";
    if (!hasPersonalErrors) setAddressOpen(true);
    document.getElementById(firstSectionId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setSubmitError("Debes completar todos los campos obligatorios correctamente.");
    if (formErrors.fullName) setFocus("fullName");
    else if (formErrors.email) setFocus("email");
  }, [setFocus]);

  return (
    <form className="mx-auto grid max-w-4xl gap-5" noValidate onSubmit={handleSubmit(onSubmit, handleInvalidSubmit)}>
      {submitError ? <div role="alert" className="rounded-2xl border border-sale/20 bg-red-50 px-4 py-3 text-sm font-medium text-sale">{submitError}</div> : null}
      <PersonalDataSection register={register} setValue={setValue} errors={errors} />
      <AddressSection mode={mode} open={addressOpen} onToggle={() => setAddressOpen((current) => !current)} register={register} errors={errors} />
      <div className="flex flex-col-reverse gap-2 pb-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => router.push(customer ? `/admin/clientes/${customer.id}` : "/admin/clientes")}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : mode === "create" ? "Agregar" : "Guardar cambios"}</Button>
      </div>
    </form>
  );
}
