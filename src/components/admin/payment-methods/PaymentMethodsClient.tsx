"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { ProviderCard } from "@/components/admin/payment-methods/ProviderCard";
import { BankTransferModal } from "@/components/admin/payment-methods/BankTransferModal";
import { GatewayModal } from "@/components/admin/payment-methods/GatewayModal";
import { DeactivateModal } from "@/components/admin/payment-methods/DeactivateModal";
import { CommerceErrorBanner, CommerceLoadingState, CommerceMutationStatus, CommerceSourceBadge } from "@/components/admin/ui/CommerceDataState";
import { useAdminPaymentMethodsStore } from "@/stores/admin-payment-methods-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";
import { cn } from "@/lib/utils";
import type { PaymentProviderDefinition, PaymentProviderId, PaymentStatus } from "@/lib/data/admin/payment-methods";
import type { BankTransferFormValues } from "@/schemas/admin/payment-method-schemas";

type PaymentFilter = "all" | PaymentStatus;
type ModalState =
  | { type: "none" }
  | { type: "bank"; providerId: PaymentProviderId }
  | { type: "gateway"; providerId: PaymentProviderId }
  | { type: "deactivate"; providerId: PaymentProviderId };

type PaymentMethodsClientProps = {
  providers: PaymentProviderDefinition[];
};

const filterTabs: Array<{ id: PaymentFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Activados" },
  { id: "inactive", label: "Desactivados" },
];

export function PaymentMethodsClient({ providers }: PaymentMethodsClientProps) {
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const providerConfigs = useAdminPaymentMethodsStore((state) => state.providers);
  const activateProvider = useAdminPaymentMethodsStore((state) => state.activateProvider);
  const updateProviderConfig = useAdminPaymentMethodsStore((state) => state.updateProviderConfig);
  const deactivateProvider = useAdminPaymentMethodsStore((state) => state.deactivateProvider);
  const clearError = useAdminPaymentMethodsStore((state) => state.clearError);
  const error = useAdminPaymentMethodsStore((state) => state.error);
  const hasLoaded = useAdminPaymentMethodsStore((state) => state.hasLoaded);
  const isEmpty = useAdminPaymentMethodsStore((state) => state.isEmpty);
  const load = useAdminPaymentMethodsStore((state) => state.load);
  const source = useAdminPaymentMethodsStore((state) => state.source);
  const status = useAdminPaymentMethodsStore((state) => state.status);
  const addToast = useAdminToastStore((state) => state.addToast);

  useEffect(() => {
    if (!hasLoaded) void load();
  }, [hasLoaded, load]);

  const activeCount = providers.filter((provider) => providerConfigs[provider.id].status === "active").length;
  const visibleProviders = providers.filter((provider) => filter === "all" || providerConfigs[provider.id].status === filter);
  const selectedProvider = modal.type === "none" ? null : providers.find((provider) => provider.id === modal.providerId) ?? null;
  const isBusy = status === "loading";

  function openConfig(providerId: PaymentProviderId) {
    clearError();
    setModal(providerId === "bank-transfer" ? { type: "bank", providerId } : { type: "gateway", providerId });
  }

  async function handleBankSubmit(values: BankTransferFormValues): Promise<boolean> {
    const config = providerConfigs["bank-transfer"];
    const succeeded = config.status === "active"
      ? await updateProviderConfig("bank-transfer", { bankConfig: values })
      : await activateProvider("bank-transfer", { bankConfig: values });

    if (!succeeded) return false;

    if (config.status === "active") {
      addToast("Configuración actualizada correctamente.", "success");
    } else {
      addToast("Transferencia Bancaria activado correctamente.", "success");
    }
    setModal({ type: "none" });
    return true;
  }

  async function handleGatewayConfirm(optionId: string): Promise<boolean> {
    if (!selectedProvider) return false;
    const config = providerConfigs[selectedProvider.id];
    const succeeded = config.status === "active"
      ? await updateProviderConfig(selectedProvider.id, { selectedOptionId: optionId })
      : await activateProvider(selectedProvider.id, { selectedOptionId: optionId });

    if (!succeeded) return false;

    if (config.status === "active") {
      addToast("Configuración actualizada correctamente.", "success");
    } else {
      addToast(`${selectedProvider.name} activado correctamente.`, "success");
    }
    setModal({ type: "none" });
    return true;
  }

  async function handleDeactivate(): Promise<boolean> {
    if (!selectedProvider) return false;
    const succeeded = await deactivateProvider(selectedProvider.id);
    if (!succeeded) return false;

    addToast("Medio de pago desactivado correctamente.", "success");
    setModal({ type: "none" });
    return true;
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader
        description="Activá, configurá y desactivá los medios de pago disponibles para el checkout."
        tag="Configuración"
        title="Medios de Pago"
      >
        <CommerceSourceBadge source={source} />
      </AdminPageHeader>

      {!hasLoaded && !error ? <CommerceLoadingState label="Cargando medios de pago…" /> : null}
      {!hasLoaded && error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : null}
      {hasLoaded && status === "loading" ? <CommerceMutationStatus /> : null}
      {hasLoaded && error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : null}

      {hasLoaded && activeCount === 0 ? (
        <Alert title="Sin medios de pago activos" tone="warning">
          Cuando el backend sincronice checkout, la tienda no tendrá medios de pago disponibles hasta que actives al menos uno.
        </Alert>
      ) : null}

      {hasLoaded && !isEmpty ? <div aria-label="Filtrar medios de pago" className="flex flex-wrap gap-2" role="tablist">
        {filterTabs.map((tab) => (
          <Button
            aria-selected={filter === tab.id}
            className={cn(filter !== tab.id && "bg-white")}
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            role="tab"
            size="sm"
            variant={filter === tab.id ? "primary" : "secondary"}
          >
            {tab.label}
          </Button>
        ))}
      </div> : null}

      {hasLoaded && isEmpty ? (
        <div className="rounded-3xl border border-border bg-white p-8 text-center text-sm font-semibold text-text-muted">
          No hay medios de pago para mostrar.
        </div>
      ) : hasLoaded && visibleProviders.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white p-8 text-center text-sm font-semibold text-text-muted">
          No hay medios de pago para mostrar.
        </div>
      ) : hasLoaded ? (
        <div className="grid min-w-0 gap-4">
          {visibleProviders.map((provider) => (
            <ProviderCard
              config={providerConfigs[provider.id]}
              disabled={isBusy}
              key={provider.id}
              onActivate={() => openConfig(provider.id)}
              onDeactivate={() => { clearError(); setModal({ type: "deactivate", providerId: provider.id }); }}
              onEdit={() => openConfig(provider.id)}
              provider={provider}
            />
          ))}
        </div>
      ) : null}

      <BankTransferModal
        initialValues={providerConfigs["bank-transfer"].bankConfig}
        onClose={() => setModal({ type: "none" })}
        onSubmit={handleBankSubmit}
        open={modal.type === "bank"}
      />
      <GatewayModal
        key={modal.type === "gateway" ? `${modal.providerId}-${providerConfigs[modal.providerId].selectedOptionId ?? "empty"}` : "gateway-closed"}
        onClose={() => setModal({ type: "none" })}
        onConfirm={handleGatewayConfirm}
        open={modal.type === "gateway"}
        provider={selectedProvider?.id === "bank-transfer" ? null : selectedProvider}
        selectedOptionId={selectedProvider ? providerConfigs[selectedProvider.id].selectedOptionId : undefined}
      />
      <DeactivateModal
        onClose={() => setModal({ type: "none" })}
        onConfirm={handleDeactivate}
        open={modal.type === "deactivate"}
        providerName={selectedProvider?.name}
      />
    </div>
  );
}
