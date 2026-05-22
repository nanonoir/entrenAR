import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/shop/account/dashboard/SectionHeader";

export function PaymentMethodsSection() {
  return (
    <div>
      <SectionHeader title="Métodos de Pago" />
      <EmptyState
        description="Todavía no tenés tarjetas guardadas. Podrás guardar una tarjeta después de realizar una compra."
        title="Sin tarjetas guardadas"
      />
    </div>
  );
}
