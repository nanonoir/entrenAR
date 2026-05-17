import { CreditCard, MapPin, PackageCheck } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { getPreviewCartItems } from "@/lib/data/cart-preview";

export default function CheckoutPage() {
  const previewCartItems = getPreviewCartItems();
  const subtotal = previewCartItems.reduce((total, item) => total + item.price * item.quantity, 0);

  return (
    <Container className="py-10" size="wide">
      <div className="mb-8">
        <p className="font-subtitle text-sm font-semibold uppercase text-accent">Checkout estatico</p>
        <h1 className="font-heading text-6xl leading-none">Finalizar compra</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-4">
          <section className="rounded-card border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <PackageCheck aria-hidden className="text-accent" size={24} />
              <h2 className="font-subtitle text-xl font-semibold uppercase">1. Revisar carrito</h2>
            </div>
            <div className="mt-4 grid gap-3">
              {previewCartItems.map((item) => (
                <div className="flex items-center justify-between gap-4 border-t border-border pt-3" key={`${item.productId}-${item.variantId}`}>
                  <div>
                    <p className="font-subtitle font-semibold uppercase">{item.name}</p>
                    <p className="text-sm text-text-muted">{item.variantLabel} x {item.quantity}</p>
                  </div>
                  <PriceDisplay price={item.price * item.quantity} size="sm" />
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-card border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <MapPin aria-hidden className="text-accent" size={24} />
              <h2 className="font-subtitle text-xl font-semibold uppercase">2. Direccion</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input label="Nombre" placeholder="Tu nombre" />
              <Input label="Telefono" placeholder="11 5555 5555" />
              <Input className="md:col-span-2" label="Direccion" placeholder="Calle, altura, piso" />
            </div>
          </section>
          <section className="rounded-card border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <CreditCard aria-hidden className="text-accent" size={24} />
              <h2 className="font-subtitle text-xl font-semibold uppercase">3. Pago manual</h2>
            </div>
            <Alert className="mt-4" title="MVP visual" tone="warning">
              MercadoPago y validaciones reales quedan para la etapa backend. Este formulario fija la experiencia.
            </Alert>
          </section>
        </div>
        <aside className="h-fit rounded-card border border-border bg-surface p-5">
          <h2 className="font-subtitle text-xl font-semibold uppercase">Resumen</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal</span>
              <PriceDisplay price={subtotal} size="sm" />
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Envio</span>
              <span className="font-semibold">A coordinar</span>
            </div>
          </div>
          <Button className="mt-5 w-full" size="lg">Confirmar pedido</Button>
        </aside>
      </div>
    </Container>
  );
}
