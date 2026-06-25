"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { ProviderConfigForm } from "@/components/admin/shipping/providers/provider-form/ProviderConfigForm";
import { useAdminShippingStore } from "@/stores/admin-shipping-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import type { ProviderFormValues } from "@/schemas/admin/shipping-schemas";

export default function ProviderConfigPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = use(params);
  const router = useRouter();
  const provider = useAdminShippingStore((state) => state.providers.find((item) => item.id === providerId));
  const saveProviderConfig = useAdminShippingStore((state) => state.saveProviderConfig);
  const addToast = useAdminToastStore((state) => state.addToast);
  if (!provider) return <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-white p-8 text-center text-sm font-semibold text-text-muted">Proveedor no encontrado.</div>;
  function handleSubmit(values: ProviderFormValues) {
    saveProviderConfig(values);
    addToast(values.status === "active" ? "Proveedor activado." : "Configuración guardada.", "success");
    router.push("/admin/envios/medios-de-envio");
  }
  return <div className="mx-auto grid w-full max-w-5xl gap-5"><AdminPageHeader tag="Envíos" title={provider.name} description="Configurá origen, modalidades y costos manuales." backLink={{ href: "/admin/envios/medios-de-envio", label: "Volver" }} /><ProviderConfigForm provider={provider} onSubmit={handleSubmit} /></div>;
}
