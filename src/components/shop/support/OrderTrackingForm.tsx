"use client";

import { AlertCircle, Search, ShoppingBag } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ShipTrackingCard } from "@/components/shop/account/cards/ShipTrackingCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { accountOrders } from "@/lib/data/account";
import { useUIStore } from "@/stores/ui-store";
import type { AccountOrder } from "@/types/account";

const invalidTrackingMessage =
  "No encontramos información para ese código por el momento. Verificá el código o iniciá sesión para ver tus pedidos.";

export function OrderTrackingForm() {
  const openAccountDrawer = useUIStore((state) => state.openAccountDrawer);
  const [trackingCode, setTrackingCode] = useState("");
  const [errorText, setErrorText] = useState<string | undefined>();
  const [result, setResult] = useState<AccountOrder | null>(null);
  const [invalidModalOpen, setInvalidModalOpen] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = trackingCode.trim().toUpperCase();
    setTrackingCode(normalizedCode);

    if (!normalizedCode) {
      setErrorText("Ingresá el código de seguimiento.");
      return;
    }

    setErrorText(undefined);
    const matchingOrder = accountOrders.find((order) => order.trackingCode.toUpperCase() === normalizedCode);

    if (!matchingOrder) {
      setResult(null);
      setInvalidModalOpen(true);
      return;
    }

    setInvalidModalOpen(false);
    setResult(matchingOrder);
  }

  function handleLoginClick() {
    setInvalidModalOpen(false);
    openAccountDrawer();
  }

  return (
    <>
      <div className="grid gap-6">
        <form className="grid gap-4 rounded-card border border-border bg-white p-5 shadow-card sm:p-6" onSubmit={handleSubmit}>
          <Input
            errorText={errorText}
            helperText="Ingresá el código tal como figura en tu comprobante. No validamos formato en esta etapa."
            id="tracking-code"
            label="Código de seguimiento*"
            onChange={(event) => {
              setTrackingCode(event.target.value.toUpperCase());
              setErrorText(undefined);
            }}
            trailingIcon={<ShoppingBag aria-hidden size={16} />}
            value={trackingCode}
          />
          <Button className="w-full sm:w-fit" size="lg" type="submit">
            <Search aria-hidden size={18} />
            Verificar pedido
          </Button>
        </form>

        {result ? (
          <section className="grid gap-3" aria-live="polite">
            <h2 className="font-subtitle text-xl font-semibold uppercase">Resultado del seguimiento</h2>
            <ShipTrackingCard order={result} />
          </section>
        ) : null}
      </div>

      <Modal className="max-w-lg" onClose={() => setInvalidModalOpen(false)} open={invalidModalOpen} title="No encontramos tu pedido">
        <div className="grid gap-5 p-6 text-center text-text">
          <AlertCircle aria-hidden className="mx-auto text-sale" size={44} />
          <div className="grid gap-2">
            <h2 className="font-subtitle text-2xl font-semibold uppercase">No encontramos tu pedido</h2>
            <p className="text-sm leading-6 text-text-muted">{invalidTrackingMessage}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={() => setInvalidModalOpen(false)} size="lg" variant="secondary">
              Reintentar
            </Button>
            <Button onClick={handleLoginClick} size="lg">
              Iniciar Sesión
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
