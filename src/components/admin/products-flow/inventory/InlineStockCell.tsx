"use client";

import { Check, Loader2, X } from "lucide-react";
import { useId, useRef, useState, useEffect } from "react";
import { useAdminProductsStore } from "@/stores/admin-products-store";
import { cn } from "@/lib/utils";

type InlineStockCellProps = {
  productId: string;
  productName: string;
  initialStock: number | "infinite";
  variantId?: string;
};

type Status = "idle" | "saving" | "success" | "error";

export function InlineStockCell({ initialStock, productId, productName, variantId }: InlineStockCellProps) {
  const id = useId();
  const updateInventoryStock = useAdminProductsStore((state) => state.updateInventoryStock);
  const [stockType, setStockType] = useState<"limited" | "infinite">(initialStock === "infinite" ? "infinite" : "limited");
  const [value, setValue] = useState(initialStock === "infinite" ? "" : String(initialStock));
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  async function saveStock(nextType = stockType) {
    const parsed = Number(value);
    if (nextType === "limited" && (!Number.isInteger(parsed) || parsed < 0)) {
      setStatus("error");
      setError("Ingresá un entero positivo o 0");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      await updateInventoryStock({ productId, variantId, stock: nextType === "infinite" ? "infinite" : parsed, reason: reason || undefined });
      setStatus("success");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus("idle"), 1200);
    } catch {
      setStatus("error");
      setError("No se pudo guardar el stock");
    }
  }

  return (
    <div className="grid min-w-0 gap-2">
      <label className="sr-only" htmlFor={id}>Stock de {productName}</label>
      <div className="flex min-w-0 gap-2">
        <select
          aria-label={`Tipo de stock de ${productName}`}
          className="h-9 shrink-0 rounded-xl border border-zinc-200 bg-white px-2 text-base outline-none md:text-sm"
          value={stockType}
          onChange={(event) => { const next = event.target.value as "limited" | "infinite"; setStockType(next); saveStock(next); }}
        >
          <option value="limited">Limitado</option>
          <option value="infinite">∞</option>
        </select>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            inputMode="numeric"
            disabled={stockType === "infinite"}
            value={stockType === "infinite" ? "∞" : value}
            onBlur={() => saveStock()}
            onChange={(event) => { setValue(event.target.value); if (status === "error") setStatus("idle"); }}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            aria-invalid={status === "error"}
            aria-describedby={status === "error" ? `${id}-error` : `${id}-helper`}
            className={cn("h-9 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 pr-9 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm", status === "success" && "border-green-500", status === "error" && "border-sale")}
          />
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
            {status === "saving" ? <Loader2 className="animate-spin text-zinc-400" size={15} /> : null}
            {status === "success" ? <Check className="text-green-600" size={15} /> : null}
            {status === "error" ? <X className="text-sale" size={15} /> : null}
          </span>
        </div>
      </div>
      <input className="h-9 rounded-xl border border-zinc-200 px-3 text-base outline-none md:text-sm" placeholder="Motivo opcional" value={reason} onChange={(event) => setReason(event.target.value)} aria-label={`Motivo de ajuste de ${productName}`} />
      <span id={`${id}-helper`} className="sr-only">Presioná Enter o salí del campo para guardar.</span>
      {status === "error" ? <span id={`${id}-error`} className="text-xs font-medium text-sale">{error}</span> : null}
    </div>
  );
}
