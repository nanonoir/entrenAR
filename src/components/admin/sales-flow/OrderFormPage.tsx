"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { FormActions } from "@/components/admin/form-actions/FormActions";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
import { orderFormSchema } from "@/schemas/admin/order-schema";
import type { OrderFormInput, OrderFormValues } from "@/schemas/admin/order-schema";
import { ProductSelectorDrawer } from "@/components/admin/sales-flow/ProductSelectorDrawer";
import { CustomerSection } from "@/components/admin/sales-flow/order-form/CustomerSection";
import { GlobalFormError } from "@/components/admin/sales-flow/order-form/GlobalFormError";
import { NotesSection } from "@/components/admin/sales-flow/order-form/NotesSection";
import { PaymentSection } from "@/components/admin/sales-flow/order-form/PaymentSection";
import { ProductsSection } from "@/components/admin/sales-flow/order-form/ProductsSection";
import { ShippingSection } from "@/components/admin/sales-flow/order-form/ShippingSection";
import { TotalsSummary } from "@/components/admin/sales-flow/order-form/TotalsSummary";
import { buildDefaultValues } from "@/components/admin/sales-flow/order-form/order-form-defaults";
import { getProductErrorMessage, safeFormNumber } from "@/components/admin/sales-flow/order-form/order-form-utils";
import { useAdminSalesStore } from "@/stores/admin-sales-store";
import { calculateTotals } from "@/lib/data/admin/sales-flow/helpers";
import type { AdminSale } from "@/lib/data/admin/sales-flow/types";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

type OrderFormPageProps = {
  mode: "create" | "edit";
  existingSale?: AdminSale;
};

export function OrderFormPage({ mode, existingSale }: OrderFormPageProps) {
  const router = useRouter();
  const { createManualSale, createPurchaseOrder, updateSale } = useAdminSalesStore();
  const isStoreLoading = useAdminSalesStore((state) => state.isLoading);
  const [productDrawerOpen, setProductDrawerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(Boolean(existingSale?.shippingAddress));

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    setFocus,
  } = useForm<OrderFormInput, unknown, OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: buildDefaultValues(existingSale),
    mode: "onBlur",
  });

  const { fields: productFields, append, remove } = useFieldArray({ control, name: "products" });

  useEffect(() => {
    register("shippingAddressEnabled");
  }, [register]);

  const watchedProducts = useWatch({ control, name: "products" });
  const watchedDiscountType = useWatch({ control, name: "discountType" });
  const watchedDiscountValue = useWatch({ control, name: "discountValue" });
  const watchedShippingCost = useWatch({ control, name: "shippingCost" });
  const currentDiscountType = watchedDiscountType === "percentage" || watchedDiscountType === "fixed" ? watchedDiscountType : undefined;

  const { subtotal, discount, total } = calculateTotals(
    (watchedProducts ?? []).map((p) => ({ quantity: Number.isFinite(p.quantity) ? p.quantity : 1, unitPrice: safeFormNumber(p.unitPrice) })),
    currentDiscountType,
    watchedDiscountValue === undefined || watchedDiscountValue === "" ? undefined : safeFormNumber(watchedDiscountValue),
    safeFormNumber(watchedShippingCost),
  );

  const { discardModal, interceptNavigation } = useUnsavedChangesGuard({ isDirty });
  const handleCancel = useCallback(() => interceptNavigation(() => router.back()), [interceptNavigation, router]);

  const onSubmit = useCallback(
    async (data: OrderFormValues) => {
      setSubmitError(null);
      setIsSubmitting(true);
      try {
        if (data.products.length === 0) {
          setSubmitError("Agregá al menos un producto antes de continuar.");
          return;
        }

        const shippingAddress =
          (data.shippingAddressEnabled || existingSale?.shippingAddress) && data.shippingStreet && data.shippingCity
            ? {
                street: data.shippingStreet,
                number: data.shippingNumber ?? "",
                floor: data.shippingFloor,
                unit: data.shippingUnit,
                city: data.shippingCity,
                province: data.shippingProvince ?? "",
                postalCode: data.shippingPostalCode ?? "",
                country: data.shippingCountry ?? "Argentina",
                notes: data.shippingNotes,
              }
            : undefined;

        const products = data.products.map((p) => ({ productId: p.productId, variantId: p.variantId, name: p.name, quantity: p.quantity, unitPrice: Number(p.unitPrice) }));

        if (mode === "create") {
          if (data.paymentOption === "unpaid") {
            const orderId = await createPurchaseOrder({ customer: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, dniOrCuil: data.dniOrCuil }, source: data.source, shippingAddress, products, discountType: data.discountType, discountValue: data.discountValue, shippingCost: Number(data.shippingCost), subtotal, total, notes: data.notes });
            if (!orderId) {
              setSubmitError(useAdminSalesStore.getState().error?.message ?? "No se pudo crear la orden. Intentá nuevamente.");
              return;
            }
            router.push(`/admin/ventas/ordenes/${orderId}`);
          } else {
            const sale = await createManualSale({ customer: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, dniOrCuil: data.dniOrCuil }, shippingAddress, products, paymentStatus: data.paymentOption, source: data.source, discountType: data.discountType, discountValue: data.discountValue, shippingCost: Number(data.shippingCost), subtotal, total, notes: data.notes });
            if (!sale) {
              setSubmitError(useAdminSalesStore.getState().error?.message ?? "No se pudo registrar la venta. Intentá nuevamente.");
              return;
            }
            router.push(`/admin/ventas/${sale.id}`);
          }
        } else if (existingSale) {
          const updated = await updateSale(existingSale.id, { customer: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, dniOrCuil: data.dniOrCuil }, shippingAddress, products, paymentStatus: data.paymentOption === "unpaid" ? "pending" : data.paymentOption, source: data.source, discountType: data.discountType, discountValue: data.discountValue, shippingCost: Number(data.shippingCost), subtotal, total, notes: data.notes });
          if (!updated) {
            setSubmitError(useAdminSalesStore.getState().error?.message ?? "No se pudieron guardar los cambios. Intentá nuevamente.");
            return;
          }
          router.push(`/admin/ventas/${existingSale.id}`);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [mode, existingSale, createManualSale, createPurchaseOrder, updateSale, router, subtotal, total],
  );

  const handleInvalidSubmit = useCallback(
    (formErrors: typeof errors) => {
      const hasCustomerErrors = Boolean(formErrors.firstName || formErrors.lastName || formErrors.email || formErrors.phone || formErrors.dniOrCuil);
      const hasProductErrors = Boolean(formErrors.products);
      const hasPaymentErrors = Boolean(formErrors.paymentOption || formErrors.discountValue || formErrors.shippingCost);
      const hasShippingErrors = Boolean(formErrors.shippingStreet || formErrors.shippingNumber || formErrors.shippingCity || formErrors.shippingProvince || formErrors.shippingPostalCode);
      const firstInvalidSectionId = hasCustomerErrors ? "customer-section" : hasProductErrors ? "products-section" : hasPaymentErrors ? "payment-section" : hasShippingErrors ? "shipping-section" : undefined;

      scrollToFirstError(formErrors, [firstInvalidSectionId].filter(Boolean) as string[]);
      if (hasCustomerErrors) setFocus(formErrors.firstName ? "firstName" : formErrors.lastName ? "lastName" : formErrors.email ? "email" : formErrors.phone ? "phone" : "dniOrCuil");

      setSubmitError(hasProductErrors ? "Debés añadir un producto como mínimo." : "Debés completar todos los campos obligatorios correctamente.");
    },
    [setFocus],
  );

  const hasErrors = Object.keys(errors).length > 0;
  const productError = getProductErrorMessage(errors.products);
  const submitLabel = mode === "create" ? "Agregar orden" : "Guardar cambios";
  const submitForm = handleSubmit(onSubmit, handleInvalidSubmit);

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title={mode === "create" ? "Nueva orden de compra" : `Editar venta ${existingSale?.number}`}
        description="Cargá cliente, productos, envío y condiciones de pago."
        tag="Ventas"
        backLink={{ href: mode === "edit" && existingSale ? `/admin/ventas/${existingSale.id}` : "/admin/ventas", label: "Volver", onNavigate: () => handleCancel() }}
      />
      <GlobalFormError message={submitError ?? (hasErrors ? "Revisá los campos marcados en rojo antes de continuar." : null)} />

      <form onSubmit={submitForm} noValidate className="grid gap-6">
        <CustomerSection register={register} setValue={setValue} errors={errors} />
        <ShippingSection open={shippingOpen} onToggle={() => { const nextOpen = !shippingOpen; setShippingOpen(nextOpen); setValue("shippingAddressEnabled", nextOpen, { shouldDirty: true, shouldValidate: false }); }} register={register} setValue={setValue} errors={errors} />
        <ProductsSection fields={productFields} watchedProducts={watchedProducts} errors={errors} productError={productError} register={register} setValue={setValue} remove={remove} onOpenDrawer={() => setProductDrawerOpen(true)} />
        <PaymentSection control={control} register={register} setValue={setValue} errors={errors} currentDiscountType={currentDiscountType} />
        <TotalsSummary subtotal={subtotal} discount={discount} shippingCost={safeFormNumber(watchedShippingCost)} total={total} />
        <NotesSection register={register} errors={errors} />

        <FormActions>
          <Button type="button" variant="secondary" size="md" onClick={handleCancel}>Cancelar</Button>
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting || isStoreLoading}>{isSubmitting || isStoreLoading ? <><Loader2 aria-hidden className="animate-spin" size={16} />Guardando…</> : submitLabel}</Button>
        </FormActions>
      </form>

      <ProductSelectorDrawer open={productDrawerOpen} onClose={() => setProductDrawerOpen(false)} selectedProductIds={productFields.map((f) => f.productId)} onAdd={(products) => append(products)} />
      {discardModal}
    </div>
  );
}
