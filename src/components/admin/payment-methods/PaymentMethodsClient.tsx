"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { ProviderCard } from "@/components/admin/payment-methods/ProviderCard";
import { BankTransferModal } from "@/components/admin/payment-methods/BankTransferModal";
import { GatewayModal } from "@/components/admin/payment-methods/GatewayModal";
import { DeactivateModal } from "@/components/admin/payment-methods/DeactivateModal";
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
  const addToast = useAdminToastStore((state) => state.addToast);

  const activeCount = providers.filter((provider) => providerConfigs[provider.id].status === "active").length;
  const visibleProviders = providers.filter((provider) => filter === "all" || providerConfigs[provider.id].status === filter);
  const selectedProvider = useMemo(
    () => (modal.type === "none" ? null : providers.find((provider) => provider.id === modal.providerId) ?? null),
    [modal, providers],
  );

  function openConfig(providerId: PaymentProviderId) {
    setModal(providerId === "bank-transfer" ? { type: "bank", providerId } : { type: "gateway", providerId });
  }

  function handleBankSubmit(values: BankTransferFormValues) {
    const config = providerConfigs["bank-transfer"];
    if (config.status === "active") {
      updateProviderConfig("bank-transfer", { bankConfig: values });
      addToast("Configuración actualizada correctamente.", "success");
    } else {
      activateProvider("bank-transfer", { bankConfig: values });
      addToast("Transferencia Bancaria activado correctamente.", "success");
    }
    setModal({ type: "none" });
  }

  function handleGatewayConfirm(optionId: string) {
    if (!selectedProvider) return;
    const config = providerConfigs[selectedProvider.id];
    if (config.status === "active") {
      updateProviderConfig(selectedProvider.id, { selectedOptionId: optionId });
      addToast("Configuración actualizada correctamente.", "success");
    } else {
      activateProvider(selectedProvider.id, { selectedOptionId: optionId });
      addToast(`${selectedProvider.name} activado correctamente.`, "success");
    }
    setModal({ type: "none" });
  }

  function handleDeactivate() {
    if (!selectedProvider) return;
    deactivateProvider(selectedProvider.id);
    addToast("Medio de pago desactivado correctamente.", "success");
    setModal({ type: "none" });
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader
        description="Activá, configurá y desactivá los medios de pago disponibles para el checkout."
        tag="Configuración"
        title="Medios de Pago"
      />

      {activeCount === 0 ? (
        <Alert title="Sin medios de pago activos" tone="warning">
          Cuando el backend sincronice checkout, la tienda no tendrá medios de pago disponibles hasta que actives al menos uno.
        </Alert>
      ) : null}

      <div aria-label="Filtrar medios de pago" className="flex flex-wrap gap-2" role="tablist">
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
      </div>

      {visibleProviders.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white p-8 text-center text-sm font-semibold text-text-muted">
          No hay medios de pago para mostrar.
        </div>
      ) : (
        <div className="grid min-w-0 gap-4">
          {visibleProviders.map((provider) => (
            <ProviderCard
              config={providerConfigs[provider.id]}
              key={provider.id}
              onActivate={() => openConfig(provider.id)}
              onDeactivate={() => setModal({ type: "deactivate", providerId: provider.id })}
              onEdit={() => openConfig(provider.id)}
              provider={provider}
            />
          ))}
        </div>
      )}

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
