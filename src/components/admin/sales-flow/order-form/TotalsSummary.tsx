import { formatARS } from "@/lib/data/admin/sales-flow/helpers";

type TotalsSummaryProps = {
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
};

export function TotalsSummary({ subtotal, discount, shippingCost, total }: TotalsSummaryProps) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-zinc-950">Resumen</h2>
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between"><dt className="text-zinc-500">Subtotal</dt><dd className="font-semibold text-zinc-900">{formatARS(subtotal)}</dd></div>
        {discount > 0 && <div className="flex justify-between"><dt className="text-zinc-500">Descuento aplicado</dt><dd className="font-semibold text-sale">−{formatARS(discount)}</dd></div>}
        <div className="flex justify-between"><dt className="text-zinc-500">Envío</dt><dd className="font-semibold text-zinc-900">{formatARS(shippingCost)}</dd></div>
        <div className="flex justify-between border-t border-zinc-100 pt-2 text-base font-bold"><dt>Total</dt><dd>{formatARS(total)}</dd></div>
      </dl>
    </section>
  );
}
