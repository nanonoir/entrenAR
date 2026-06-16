"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { inlineProductPriceSchema } from "@/schemas/admin/product-schemas";
import { useAdminProductsStore } from "@/stores/admin-products-store";
import { cn } from "@/lib/utils";

type PriceField = "salePrice" | "promotionalPrice";
type SaveStatus = "idle" | "saving" | "success" | "error";

type InlinePriceCellProps = {
  productId: string;
  productName: string;
  field: PriceField;
  salePrice: number;
  promotionalPrice?: number;
};

function formatPriceInput(value?: number) {
  return value === undefined ? "" : String(value);
}

export function InlinePriceCell({ productId, productName, field, salePrice, promotionalPrice }: InlinePriceCellProps) {
  const inputId = useId();
  const updateProductPrice = useAdminProductsStore((state) => state.updateProductPrice);
  const [value, setValue] = useState(field === "salePrice" ? formatPriceInput(salePrice) : formatPriceInput(promotionalPrice));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const label = field === "salePrice" ? `Precio de ${productName}` : `Precio promocional de ${productName}`;

  async function saveValue() {
    const currentValue = field === "salePrice" ? formatPriceInput(salePrice) : formatPriceInput(promotionalPrice);
    if (value.trim() === currentValue) return;

    const parsed = inlineProductPriceSchema.safeParse({
      salePrice: field === "salePrice" ? value : formatPriceInput(salePrice),
      promotionalPrice: field === "promotionalPrice" ? value : formatPriceInput(promotionalPrice),
    });

    if (!parsed.success) {
      const issue = parsed.error.issues.find((item) => item.path[0] === field) ?? parsed.error.issues[0];
      setError(issue?.message ?? "Revisá el valor ingresado");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setError("");

    try {
      await updateProductPrice(productId, parsed.data);
      setValue(field === "salePrice" ? formatPriceInput(parsed.data.salePrice) : formatPriceInput(parsed.data.promotionalPrice));
      setStatus("success");
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setStatus("idle"), 1200);
    } catch {
      setError("No se pudo guardar el precio");
      setStatus("error");
    }
  }

  return (
    <div className="grid min-w-0 gap-1">
      <label className="sr-only" htmlFor={inputId}>{label}</label>
      <div className="relative min-w-0">
        <input
          id={inputId}
          inputMode="decimal"
          value={value}
          onBlur={saveValue}
          onChange={(event) => {
            setValue(event.target.value);
            if (status === "error") {
              setStatus("idle");
              setError("");
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? errorId : helperId}
          className={cn(
            "h-9 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 pr-9 text-base font-semibold text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm",
            field === "promotionalPrice" && "text-accent",
            status === "success" && "border-green-500 focus:border-green-500 focus:ring-green-500/20",
            status === "error" && "border-sale focus:border-sale focus:ring-sale/20",
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          {status === "saving" ? <Loader2 aria-hidden className="animate-spin text-zinc-400" size={15} /> : null}
          {status === "success" ? <Check aria-hidden className="text-green-600" size={15} /> : null}
          {status === "error" ? <X aria-hidden className="text-sale" size={15} /> : null}
        </span>
      </div>
      <span id={helperId} className="sr-only">Presioná Enter o salí del campo para guardar.</span>
      {status === "error" ? <span id={errorId} className="text-xs font-medium text-sale">{error}</span> : null}
    </div>
  );
}
