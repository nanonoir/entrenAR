"use client";

import { LockKeyhole } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { CheckoutDelivery } from "@/components/checkout/CheckoutDelivery";
import { CheckoutIdentification } from "@/components/checkout/CheckoutIdentification";
import { CheckoutPayment } from "@/components/checkout/CheckoutPayment";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { useCheckoutWizard } from "@/components/checkout/use-checkout-wizard";

export function CheckoutWizard() {
  const wizard = useCheckoutWizard();

  if (!wizard.hydrated) {
    return (
      <Container className="py-10" size="wide">
        <div className="h-60 rounded-card border border-border bg-surface" />
      </Container>
    );
  }

  const paymentStep = (
    <CheckoutPayment
      canOpen={wizard.canOpenStep("payment")}
      completed={wizard.completedSteps.payment}
      completion={wizard.completion}
      isActive={wizard.activeStep === "payment"}
      onOpen={() => wizard.openStep("payment")}
      onSelectPayment={wizard.handleSelectPayment}
      onTransferProofChange={wizard.handleTransferProofChange}
      selectedPaymentId={wizard.selectedPaymentId}
    />
  );

  if (wizard.completion) {
    return paymentStep;
  }

  if (wizard.items.length === 0) {
    return (
      <Container className="py-10" size="wide">
        <EmptyState
          action={<LinkButton href="/" variant="secondary">Seguir comprando</LinkButton>}
          description="Agregá al menos un producto al carrito antes de iniciar el checkout."
          title="Tu carrito está vacío"
        />
      </Container>
    );
  }

  return (
    <Container className="py-10" size="wide">
      <h1 className="font-title text-3xl font-bold text-text sm:text-4xl">Checkout</h1>
      <div className="mt-4 grid gap-3">
        {wizard.hasValidationErrors ? (
          <div role="alert">
            <Alert title="Revisá los datos del checkout" tone="danger">
              Completá los campos indicados antes de continuar.
            </Alert>
          </div>
        ) : null}
        {wizard.showConfigurationIssue ? (
          <div role="alert">
            <Alert title="Configuración de checkout incompleta" tone="warning">
              {wizard.configurationIssue}
            </Alert>
          </div>
        ) : null}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-4 lg:items-start">
        <section className="grid gap-4 lg:col-span-3">
          <CheckoutIdentification
            canOpen={wizard.canOpenStep("identification")}
            completed={wizard.completedSteps.identification}
            errors={wizard.identificationErrors}
            form={wizard.identificationForm}
            isActive={wizard.activeStep === "identification"}
            onContinue={() => wizard.continueFrom("identification")}
            onFieldChange={wizard.updateIdentificationField}
            onOpen={() => wizard.openStep("identification")}
          />

          <CheckoutDelivery
            canOpen={wizard.canOpenStep("delivery")}
            completed={wizard.completedSteps.delivery}
            errors={wizard.deliveryErrors}
            form={wizard.deliveryForm}
            hasFreeShipping={wizard.hasFreeShipping}
            isActive={wizard.activeStep === "delivery"}
            location={wizard.detectedLocation}
            onContinue={() => wizard.continueFrom("delivery")}
            onFieldChange={wizard.updateDeliveryField}
            onOpen={() => wizard.openStep("delivery")}
            onSelectMethod={wizard.handleSelectDeliveryMethod}
            onSelectPickupPoint={wizard.handleSelectPickupPoint}
            onSelectProvider={wizard.handleSelectProvider}
            selectedMethod={wizard.deliveryMethod}
            selectedPickupPointId={wizard.selectedPickupPoint?.id ?? null}
            selectedProviderId={wizard.selectedProvider?.id ?? ""}
          />

          {paymentStep}
        </section>

        <div className="lg:col-span-1">
            <CheckoutSummary
              actionLabel="Finalizar Compra"
              discountTotal={wizard.discountTotal}
              freeShippingRemaining={wizard.freeShippingRemaining}
              items={wizard.items}
              onAction={wizard.handleFinalize}
              actionDisabled={!wizard.canFinalize}
              actionHelpText={wizard.actionHelpText}
              onRefreshQuote={wizard.refreshQuote}
              reconciliationMessage={wizard.reconciliationMessage}
              shippingCost={wizard.selectedProvider?.price ?? null}
              subtotal={wizard.subtotal}
          />
          <p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-text-muted">
            <LockKeyhole aria-hidden size={14} />
            Compra 100% segura
          </p>
        </div>
      </div>
    </Container>
  );
}
