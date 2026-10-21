"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { CheckoutBoundPayment } from "@/components/checkout/CheckoutBoundPayment";
import { DATA_SOURCE, getCheckoutDataSource } from "@/lib/api/config";
import { BOUND_ORDER_MODE, resolveBoundOrderMode } from "@/lib/api/payments/payment-result";
import { checkoutRoutes } from "@/lib/routes";
import { useCheckoutPaymentStore } from "@/stores/checkout-payment-store";
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
  const router = useRouter();
  const view = useCheckoutPaymentStore((state) => state.view);
  const recovery = useCheckoutPaymentStore((state) => state.recovery);
  const recover = useCheckoutPaymentStore((state) => state.recover);
  const recoveryEnabled = getCheckoutDataSource() === DATA_SOURCE.API;
  const boundMode = view ? resolveBoundOrderMode(view) : null;
  const bound = boundMode === BOUND_ORDER_MODE.CHALLENGE || boundMode === BOUND_ORDER_MODE.RETRY;
  const [wasBound, setWasBound] = useState(false);
  const recoveryPending = recoveryEnabled && recovery !== "done";
  const redirectToResult = Boolean(
    view && boundMode === BOUND_ORDER_MODE.RESULT && !recoveryPending && (wasBound || wizard.items.length === 0),
  );

  if (bound && !wasBound) setWasBound(true);

  useEffect(() => {
    // The active order is recovered before the empty-cart branch can render.
    if (wizard.hydrated && recoveryEnabled && recovery === "idle") void recover();
  }, [recover, recovery, recoveryEnabled, wizard.hydrated]);

  useEffect(() => {
    if (redirectToResult && view) router.replace(checkoutRoutes.result(view.orderId));
  }, [redirectToResult, router, view]);

  if (!wizard.hydrated || recoveryPending || redirectToResult) {
    return (
      <Container className="py-10" size="wide">
        <div aria-busy className="h-60 rounded-card border border-border bg-surface" />
      </Container>
    );
  }

  if (view && bound) return <CheckoutBoundPayment view={view} />;

  const paymentStep = (
    <CheckoutPayment
      card={wizard.card}
      onRefreshQuote={wizard.refreshQuote}
      canOpen={wizard.canOpenStep("payment")}
      completed={wizard.completedSteps.payment}
      completion={wizard.completion}
      isActive={wizard.activeStep === "payment"}
      onOpen={() => wizard.openStep("payment")}
      onSelectPayment={wizard.handleSelectPayment}
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
      <h1 className="font-heading text-3xl font-bold text-text sm:text-4xl">Checkout</h1>
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
            onBlurField={wizard.blurIdentificationField}
            onContinue={() => wizard.continueFrom("identification")}
            onFieldChange={wizard.updateIdentificationField}
            onOpen={() => wizard.openStep("identification")}
          />

          <CheckoutDelivery
            canOpen={wizard.canOpenStep("delivery")}
            completed={wizard.completedSteps.delivery}
            errors={wizard.deliveryErrors}
            form={wizard.deliveryForm}
            isActive={wizard.activeStep === "delivery"}
            onBlurField={wizard.blurDeliveryField}
            onContinue={() => wizard.continueFrom("delivery")}
            onFieldChange={wizard.updateDeliveryField}
            onModeChange={wizard.handleSetLocalityMode}
            onOpen={() => wizard.openStep("delivery")}
            onSelectLocality={wizard.handleSelectLocality}
            onSelectMethod={wizard.handleSelectDeliveryMethod}
            onSelectPickupPoint={wizard.handleSelectPickupPoint}
            onSelectProvince={wizard.handleSelectProvince}
            onSelectShipping={wizard.handleSelectShipping}
            selectedMethod={wizard.deliveryMethod}
            selectedPickupPointId={wizard.selectedPickupPointId}
            selectedShippingId={wizard.selectedShippingId}
          />

          {paymentStep}
        </section>

        <div className="lg:col-span-1">
            <CheckoutSummary
              actionLabel="Finalizar Compra"
              discountTotal={wizard.discountTotal}
              hideAction={wizard.card.active}
              items={wizard.items}
              onAction={wizard.handleFinalize}
              actionDisabled={!wizard.canFinalize}
              actionHelpText={wizard.actionHelpText}
              onApplyCoupon={wizard.applyCoupon}
              onRefreshQuote={wizard.refreshQuote}
              reconciliationMessage={wizard.reconciliationMessage}
              shippingResolved={wizard.shippingResolved}
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
