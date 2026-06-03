"use client";

import { useEffect, useState } from "react";
import { User, Truck, CreditCard, CheckCircle2, LockKeyhole, Pencil, Mail, IdCard, Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { LinkButton } from "@/components/ui/LinkButton";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { DeliveryOptions } from "@/components/checkout/DeliveryOptions";
import { PaymentOptions } from "@/components/checkout/PaymentOptions";
import { BankTransferPanel } from "@/components/checkout/BankTransferPanel";
import { useCartTotals } from "@/hooks/useCartTotals";
import {
  checkoutPostalCodeLocations,
  type CheckoutPaymentMethodId,
  type CheckoutPickupPoint,
  type CheckoutShippingProvider,
} from "@/lib/data/checkout";
import {
  isValidDni,
  isValidEmail,
  isValidNumericOnly,
  isValidPhone,
  isValidTextOnly,
  sanitizeNumericInput,
  sanitizePhoneInput,
  sanitizeTextInput,
} from "@/lib/checkout-validation";
import { useCartStore } from "@/stores/cart-store";
import { cn } from "@/lib/utils";

type CheckoutStep = "identification" | "delivery" | "payment";
type DeliveryMethod = "home" | "pickup" | null;

type IdentificationForm = {
  email: string;
  firstName: string;
  lastName: string;
  dni: string;
  phone: string;
};

type DeliveryForm = {
  postalCode: string;
  street: string;
  streetNumber: string;
  floor: string;
  city: string;
  neighborhood: string;
  recipient: string;
};

type FieldErrors<T extends Record<string, string>> = Partial<Record<keyof T, string>>;

const stepOrder: CheckoutStep[] = ["identification", "delivery", "payment"];

const stepLabels = {
  identification: "Identificación",
  delivery: "Entrega",
  payment: "Pago",
} satisfies Record<CheckoutStep, string>;

function getNextStep(step: CheckoutStep): CheckoutStep {
  const nextIndex = Math.min(stepOrder.length - 1, stepOrder.indexOf(step) + 1);
  return stepOrder[nextIndex];
}

export function CheckoutSteps() {
  const items = useCartStore((state) => state.items);
  const { discountTotal, freeShippingRemaining, subtotal } = useCartTotals(items);
  const [activeStep, setActiveStep] = useState<CheckoutStep>("identification");
  const [completedSteps, setCompletedSteps] = useState<Record<CheckoutStep, boolean>>({
    identification: false,
    delivery: false,
    payment: false,
  });
  const [identificationForm, setIdentificationForm] = useState<IdentificationForm>({
    dni: "",
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>({
    city: "",
    floor: "",
    neighborhood: "",
    postalCode: "",
    recipient: "",
    street: "",
    streetNumber: "",
  });
  const [identificationErrors, setIdentificationErrors] = useState<FieldErrors<IdentificationForm>>({});
  const [deliveryErrors, setDeliveryErrors] = useState<FieldErrors<DeliveryForm>>({});
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(null);
  const [selectedProvider, setSelectedProvider] = useState<CheckoutShippingProvider | null>(null);
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<CheckoutPickupPoint | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<CheckoutPaymentMethodId>("mercado-pago");
  const [transferProofFileName, setTransferProofFileName] = useState("");
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const hasFreeShipping = freeShippingRemaining === 0;
  const detectedLocation = checkoutPostalCodeLocations.find(
    (location) => location.postalCode === deliveryForm.postalCode,
  );

  useEffect(() => {
    Promise.resolve(useCartStore.persist.rehydrate()).finally(() => setHydrated(true));
  }, []);

  function continueFrom(step: CheckoutStep) {
    if (step === "identification" && !validateIdentification()) {
      return;
    }

    if (step === "delivery" && !validateDelivery()) {
      return;
    }

    setCompletedSteps((current) => ({ ...current, [step]: true }));
    setActiveStep(getNextStep(step));
  }

  function canOpenStep(step: CheckoutStep) {
    if (step === "identification") {
      return true;
    }

    if (step === "delivery") {
      return completedSteps.identification;
    }

    return completedSteps.identification && completedSteps.delivery;
  }

  function openStep(step: CheckoutStep) {
    if (canOpenStep(step)) {
      setActiveStep(step);
    }
  }

  function invalidateFrom(step: CheckoutStep) {
    setCompletedSteps((current) => {
      if (step === "identification") {
        return { identification: false, delivery: false, payment: false };
      }

      if (step === "delivery") {
        return { ...current, delivery: false, payment: false };
      }

      return { ...current, payment: false };
    });
  }

  function updateIdentificationField(field: keyof IdentificationForm, value: string) {
    const nextValue = field === "dni" ? sanitizeNumericInput(value) : field === "phone" ? sanitizePhoneInput(value) : field === "email" ? value : sanitizeTextInput(value);

    setIdentificationForm((current) => ({ ...current, [field]: nextValue }));
    setIdentificationErrors((current) => ({ ...current, [field]: undefined }));
    invalidateFrom("identification");
  }

  function updateDeliveryField(field: keyof DeliveryForm, value: string) {
    const nextValue = field === "postalCode" || field === "streetNumber"
      ? sanitizeNumericInput(value)
      : field === "floor"
        ? value
        : sanitizeTextInput(value);

    setDeliveryForm((current) => ({
      ...current,
      [field]: nextValue,
      ...(field === "postalCode" ? { city: "" } : null),
    }));
    setDeliveryErrors((current) => ({ ...current, [field]: undefined }));
    invalidateFrom("delivery");
  }

  function validateIdentification() {
    const nextErrors: FieldErrors<IdentificationForm> = {};

    if (!identificationForm.email.trim()) {
      nextErrors.email = "Ingresá tu correo.";
    } else if (!isValidEmail(identificationForm.email)) {
      nextErrors.email = "Ingresá un correo válido.";
    }

    if (!identificationForm.firstName.trim()) {
      nextErrors.firstName = "Ingresá tus nombres.";
    } else if (!isValidTextOnly(identificationForm.firstName)) {
      nextErrors.firstName = "Usá solo letras.";
    }

    if (!identificationForm.lastName.trim()) {
      nextErrors.lastName = "Ingresá tu apellido.";
    } else if (!isValidTextOnly(identificationForm.lastName)) {
      nextErrors.lastName = "Usá solo letras.";
    }

    if (!identificationForm.dni.trim()) {
      nextErrors.dni = "Ingresá tu DNI.";
    } else if (!isValidDni(identificationForm.dni)) {
      nextErrors.dni = "El DNI debe tener entre 6 y 9 números.";
    }

    if (!identificationForm.phone.trim()) {
      nextErrors.phone = "Ingresá un teléfono de contacto.";
    } else if (!isValidPhone(identificationForm.phone)) {
      nextErrors.phone = "El teléfono debe tener entre 10 y 13 dígitos.";
    }

    setIdentificationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateDelivery() {
    const nextErrors: FieldErrors<DeliveryForm> = {};

    if (!deliveryForm.postalCode.trim()) {
      nextErrors.postalCode = "Ingresá tu código postal.";
    } else if (!detectedLocation) {
      nextErrors.postalCode = "Código postal sin datos mock disponibles.";
    }

    if (!deliveryMethod) {
      nextErrors.street = "Seleccioná una forma de entrega.";
    }

    if (!deliveryForm.city.trim()) {
      nextErrors.city = "Seleccioná una ciudad.";
    }

    if (deliveryMethod === "home") {
      if (!selectedProvider) {
        nextErrors.postalCode = nextErrors.postalCode ?? "Seleccioná una opción de envío.";
      }

      if (!deliveryForm.street.trim()) {
        nextErrors.street = "Ingresá la calle.";
      } else if (!isValidTextOnly(deliveryForm.street)) {
        nextErrors.street = "Usá solo letras.";
      }

      if (!deliveryForm.streetNumber.trim()) {
        nextErrors.streetNumber = "Ingresá el número.";
      } else if (!isValidNumericOnly(deliveryForm.streetNumber)) {
        nextErrors.streetNumber = "Usá solo números.";
      }

      if (deliveryForm.neighborhood && !isValidTextOnly(deliveryForm.neighborhood)) {
        nextErrors.neighborhood = "Usá solo letras.";
      }

      if (deliveryForm.recipient && !isValidTextOnly(deliveryForm.recipient)) {
        nextErrors.recipient = "Usá solo letras.";
      }
    }

    if (deliveryMethod === "pickup" && !selectedPickupPoint) {
      nextErrors.postalCode = nextErrors.postalCode ?? "Seleccioná un punto de retiro.";
    }

    setDeliveryErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleFinalize() {
    if (!validateIdentification()) {
      invalidateFrom("identification");
      setActiveStep("identification");
      return;
    }

    if (!validateDelivery()) {
      setCompletedSteps((current) => ({ ...current, identification: true, delivery: false, payment: false }));
      setActiveStep("delivery");
      return;
    }

    if (selectedPaymentId === "bank-transfer") {
      if (!transferProofFileName) {
        invalidateFrom("payment");
        setActiveStep("payment");
        setShowTransferPanel(true);
        return;
      }

      setActiveStep("payment");
      setShowTransferPanel(true);
      setCompletedSteps((current) => ({ ...current, payment: true }));
      return;
    }

    setCompletedSteps((current) => ({ ...current, payment: true }));
    window.alert("Redirección estática de prueba. No se crea un pago real en esta fase.");
  }

  function handleSelectDeliveryMethod(method: DeliveryMethod) {
    setDeliveryMethod(method);
    setSelectedProvider(null);
    setSelectedPickupPoint(null);
    setDeliveryErrors({});
    invalidateFrom("delivery");
  }

  function handleSelectProvider(provider: CheckoutShippingProvider) {
    setSelectedProvider(provider);
    setDeliveryErrors((current) => ({ ...current, postalCode: undefined }));
    invalidateFrom("delivery");
  }

  function handleSelectPickupPoint(point: CheckoutPickupPoint) {
    setSelectedPickupPoint(point);
    setDeliveryErrors((current) => ({ ...current, postalCode: undefined }));
    invalidateFrom("delivery");
  }

  function handleSelectPayment(id: CheckoutPaymentMethodId) {
    setSelectedPaymentId(id);
    setShowTransferPanel(id === "bank-transfer");
    invalidateFrom("payment");
  }

  function handleTransferProofFileSelect(fileName: string) {
    setTransferProofFileName(fileName);
    invalidateFrom("payment");
  }

  const canFinalize = completedSteps.identification
    && completedSteps.delivery
    && items.length > 0
    && (selectedPaymentId !== "bank-transfer" || Boolean(transferProofFileName));

  if (!hydrated) {
    return (
      <Container className="py-10" size="wide">
        <div className="h-60 rounded-card border border-border bg-surface" />
      </Container>
    );
  }

  if (items.length === 0) {
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
      <div className="mt-6 grid gap-6 lg:grid-cols-4 lg:items-start">
        <section className="grid gap-4 lg:col-span-3">
          <CheckoutStepPanel
            canOpen={canOpenStep("identification")}
            completed={completedSteps.identification}
            icon={<User aria-hidden size={18} />}
            isActive={activeStep === "identification"}
            onOpen={() => openStep("identification")}
            step="1"
            title={stepLabels.identification}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input errorText={identificationErrors.email} helperText="Usaremos este correo para enviarte novedades del pedido." id="checkout-email" label="Correo*" onChange={(event) => updateIdentificationField("email", event.target.value)} trailingIcon={<Mail aria-hidden size={16} />} type="email" value={identificationForm.email} />
              <Input errorText={identificationErrors.firstName} helperText="Tu nombre legal o de contacto." id="checkout-first-name" label="Nombres*" onChange={(event) => updateIdentificationField("firstName", event.target.value)} trailingIcon={<User aria-hidden size={16} />} value={identificationForm.firstName} />
              <Input errorText={identificationErrors.lastName} helperText="Tu apellido." id="checkout-last-name" label="Apellido*" onChange={(event) => updateIdentificationField("lastName", event.target.value)} trailingIcon={<User aria-hidden size={16} />} value={identificationForm.lastName} />
              <Input errorText={identificationErrors.dni} helperText="Documento para identificación de la compra." id="checkout-dni" label="DNI*" onChange={(event) => updateIdentificationField("dni", event.target.value)} trailingIcon={<IdCard aria-hidden size={16} />} value={identificationForm.dni} />
              <Input errorText={identificationErrors.phone} helperText="Teléfono para coordinación de entrega." id="checkout-phone" label="Teléfono/Celular*" onChange={(event) => updateIdentificationField("phone", event.target.value)} trailingIcon={<Phone aria-hidden size={16} />} value={identificationForm.phone} />
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm text-text-muted">
              <input className="mt-1 accent-accent" type="checkbox" />
              Quiero recibir notificaciones de ofertas y promociones
            </label>
            <Button className="mt-5" onClick={() => continueFrom("identification")}>Continuar</Button>
          </CheckoutStepPanel>

          <CheckoutStepPanel
            canOpen={canOpenStep("delivery")}
            completed={completedSteps.delivery}
            icon={<Truck aria-hidden size={18} />}
            isActive={activeStep === "delivery"}
            onOpen={() => openStep("delivery")}
            step="2"
            title={stepLabels.delivery}
          >
            <DeliveryOptions
              errors={deliveryErrors}
              form={deliveryForm}
              hasFreeShipping={hasFreeShipping}
              location={detectedLocation}
              onFieldChange={updateDeliveryField}
              onSelectMethod={handleSelectDeliveryMethod}
              onSelectPickupPoint={handleSelectPickupPoint}
              onSelectProvider={handleSelectProvider}
              selectedMethod={deliveryMethod}
              selectedPickupPointId={selectedPickupPoint?.id ?? null}
              selectedProviderId={selectedProvider?.id ?? ""}
            />
            <Button className="mt-5" onClick={() => continueFrom("delivery")}>Continuar</Button>
          </CheckoutStepPanel>

          <CheckoutStepPanel
            canOpen={canOpenStep("payment")}
            completed={completedSteps.payment}
            icon={<CreditCard aria-hidden size={18} />}
            isActive={activeStep === "payment"}
            onOpen={() => openStep("payment")}
            step="3"
            title={stepLabels.payment}
          >
            <PaymentOptions onSelectPayment={handleSelectPayment} selectedPaymentId={selectedPaymentId} />
            <BankTransferPanel
              fileName={transferProofFileName}
              onFileSelect={handleTransferProofFileSelect}
              open={showTransferPanel || selectedPaymentId === "bank-transfer"}
            />
          </CheckoutStepPanel>
        </section>

        <div className="lg:col-span-1">
          <CheckoutSummary
            actionLabel="Finalizar Compra"
            discountTotal={discountTotal}
            freeShippingRemaining={freeShippingRemaining}
            items={items}
            onAction={handleFinalize}
            actionDisabled={!canFinalize}
            shippingCost={selectedProvider?.price ?? null}
            subtotal={subtotal}
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

type CheckoutStepPanelProps = {
  canOpen: boolean;
  children: React.ReactNode;
  completed: boolean;
  icon: React.ReactNode;
  isActive: boolean;
  onOpen: () => void;
  step: string;
  title: string;
};

function CheckoutStepPanel({ canOpen, children, completed, icon, isActive, onOpen, step, title }: CheckoutStepPanelProps) {
  return (
    <article className={cn("rounded-card border border-border bg-surface shadow-card", !canOpen && "opacity-70")}>
      <button
        className="flex w-full items-center justify-between gap-4 p-5 text-left disabled:cursor-not-allowed"
        disabled={!canOpen}
        onClick={onOpen}
        type="button"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent-hover">{icon}</span>
          <span>
            <span className="block text-xs font-semibold uppercase text-text-muted">Paso {step}</span>
            <strong className="font-subtitle text-lg uppercase text-text">{title}</strong>
          </span>
        </span>
        {completed && !isActive ? (
          <span className="inline-flex items-center gap-2 rounded-button border border-border px-3 py-2 font-subtitle text-xs font-semibold uppercase text-text-muted hover:border-accent hover:text-accent">
            Modificar
            <Pencil aria-hidden size={14} />
          </span>
        ) : (
          <CheckCircle2 className={cn(isActive || completed ? "text-accent" : "text-border")} aria-hidden size={20} />
        )}
      </button>
      {isActive ? <div className="border-t border-border p-5">{children}</div> : null}
    </article>
  );
}
