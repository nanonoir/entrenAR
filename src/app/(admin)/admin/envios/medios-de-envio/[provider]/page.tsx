"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { ProviderConfigForm } from "@/components/admin/shipping/providers/provider-form/ProviderConfigForm";
import { CommerceErrorBanner, CommerceLoadingState, CommerceSourceBadge } from "@/components/admin/ui/CommerceDataState";
import { useAdminShippingStore } from "@/stores/admin-shipping-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import type { ProviderFormValues } from "@/schemas/admin/shipping-schemas";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

export default function ProviderConfigPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = use(params);
  const router = useRouter();
  const provider = useAdminShippingStore((state) => state.providers.find((item) => item.id === providerId));
  const saveProviderConfig = useAdminShippingStore((state) => state.saveProviderConfig);
  const error = useAdminShippingStore((state) => state.error);
  const hasLoaded = useAdminShippingStore((state) => state.hasLoaded);
  const load = useAdminShippingStore((state) => state.load);
  const source = useAdminShippingStore((state) => state.source);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [formDirty, setFormDirty] = useState(false);
  const { discardModal, interceptNavigation } = useUnsavedChangesGuard({ isDirty: formDirty });
  useEffect(() => {
    if (!hasLoaded) void load();
  }, [hasLoaded, load]);

  if (!hasLoaded) return <div className="mx-auto grid w-full max-w-5xl gap-4">{error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : <CommerceLoadingState label="Cargando proveedor…" />}</div>;
  if (!provider) return <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-white p-8 text-center text-sm font-semibold text-text-muted">Proveedor no encontrado.</div>;
  async function handleSubmit(values: ProviderFormValues): Promise<boolean> {
    const succeeded = await saveProviderConfig(values);
    if (!succeeded) return false;

    addToast(values.status === "active" ? "Proveedor activado." : "Configuración guardada.", "success");
    router.push("/admin/envios/medios-de-envio");
    return true;
  }
  return <div className="mx-auto grid w-full max-w-5xl gap-5"><AdminPageHeader tag="Envíos" title={provider.name} description="Configurá origen, modalidades y costos manuales." backLink={{ href: "/admin/envios/medios-de-envio", label: "Volver", onNavigate: interceptNavigation }}><CommerceSourceBadge source={source} /></AdminPageHeader><ProviderConfigForm provider={provider} onSubmit={handleSubmit} onDirtyChange={setFormDirty} interceptNavigation={interceptNavigation} />{discardModal}</div>;
}
