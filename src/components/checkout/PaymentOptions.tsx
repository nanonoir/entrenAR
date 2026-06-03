import Image from "next/image";
import { checkoutPaymentMethods, type CheckoutPaymentMethodId } from "@/lib/data/checkout";
import { cn } from "@/lib/utils";

type PaymentOptionsProps = {
  selectedPaymentId: CheckoutPaymentMethodId;
  onSelectPayment: (id: CheckoutPaymentMethodId) => void;
};

export function PaymentOptions({ onSelectPayment, selectedPaymentId }: PaymentOptionsProps) {
  return (
    <div className="grid gap-3">
      {checkoutPaymentMethods.map((method) => (
        <button
          className={cn(
            "rounded-card border bg-surface p-4 text-left transition",
            selectedPaymentId === method.id ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent",
          )}
          key={method.id}
          onClick={() => onSelectPayment(method.id)}
          type="button"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-28 shrink-0 items-center justify-center">
                <Image alt={method.title} className="max-h-9 max-w-24 object-contain" height={36} src={method.logoSrc} width={112} />
              </span>
              <strong className="font-subtitle text-base uppercase text-text">{method.title}</strong>
            </span>
            {method.id === "bank-transfer" ? (
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-hover">10% OFF</span>
            ) : null}
          </span>
          <span className="mt-2 block text-sm text-text-muted">{method.description}</span>
          <span className="mt-1 block text-xs text-text-muted">{method.helper}</span>
        </button>
      ))}
    </div>
  );
}
