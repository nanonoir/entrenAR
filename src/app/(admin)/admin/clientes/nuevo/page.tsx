import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { CustomerCreatePageClient } from "@/app/(admin)/admin/clientes/nuevo/CustomerCreatePageClient";

export default function CustomerCreatePage() {
  return (
    <div className="grid gap-5">
      <AdminPageHeader title="Agregar cliente" description="Cargá datos personales y dirección de envío opcional." tag="Clientes" backLink={{ href: "/admin/clientes", label: "Volver" }} />
      <CustomerCreatePageClient />
    </div>
  );
}
