"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { useId, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [stockType, setStockType] = useState<"limited" | "infinite">(initialStock === "infinite" ? "infinite" : "limited");
  const [value, setValue] = useState(initialStock === "infinite" ? "" : String(initialStock));
  const [operation, setOperation] = useState<"add" | "subtract" | "replace">("replace");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popoverWidth = Math.min(320, window.innerWidth - 32);
      setPopoverPosition({
        top: rect.bottom + window.scrollY + 8,
        left: Math.min(Math.max(16, rect.right + window.scrollX - popoverWidth), window.scrollX + window.innerWidth - popoverWidth - 16),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const currentStock = initialStock === "infinite" ? 0 : Number(initialStock);
  const displayStock = initialStock === "infinite" ? "∞" : `${initialStock} unidades`;

  async function saveStock(nextType = stockType) {
    const parsed = Number(value);
    const effectiveOperation = initialStock === "infinite" && nextType === "limited" ? "replace" : operation;
    if (nextType === "limited" && (!Number.isInteger(parsed) || parsed < 0)) {
      setStatus("error");
      setError("Ingresá un entero positivo o 0");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const computedStock = effectiveOperation === "add" ? currentStock + parsed : effectiveOperation === "subtract" ? Math.max(0, currentStock - parsed) : parsed;
      await updateInventoryStock({ productId, variantId, stock: nextType === "infinite" ? "infinite" : computedStock, reason: reason || undefined });
      setStatus("success");
      setOpen(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus("idle"), 1200);
    } catch {
      setStatus("error");
      setError("No se pudo guardar el stock");
    }
  }

  return (
    <div className="relative min-w-0 overflow-visible">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-label={`Editar stock de ${productName}`}
        onClick={() => setOpen((current) => !current)}
        className={cn("inline-flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:border-accent", status === "success" && "border-green-500", status === "error" && "border-sale")}
      >
        <span className="truncate">{displayStock}</span>
        <span className="flex shrink-0 items-center gap-1">
          {status === "saving" ? <Loader2 className="animate-spin text-zinc-400" size={15} /> : null}
          {status === "success" ? <Check className="text-green-600" size={15} /> : null}
          {status === "error" ? <X className="text-sale" size={15} /> : null}
          <Pencil aria-hidden size={14} />
        </span>
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div ref={popoverRef} className="z-50 grid w-[min(20rem,calc(100vw-2rem))] gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl" style={{ position: "absolute", top: popoverPosition.top, left: popoverPosition.left }}>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-zinc-950">Tipo de stock</legend>
            <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="radio" name={`${id}-stock-type`} checked={stockType === "infinite"} onChange={() => setStockType("infinite")} /> Infinito</label>
            <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="radio" name={`${id}-stock-type`} checked={stockType === "limited"} onChange={() => { setStockType("limited"); if (initialStock === "infinite") setOperation("replace"); }} /> Limitado</label>
          </fieldset>
          {stockType === "limited" ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-2">
                <StockOperationButton disabled={initialStock === "infinite"} active={operation === "add"} onClick={() => setOperation("add")}>Agregar</StockOperationButton>
                <StockOperationButton disabled={initialStock === "infinite"} active={operation === "subtract"} onClick={() => setOperation("subtract")}>Descontar</StockOperationButton>
                <StockOperationButton active={operation === "replace"} onClick={() => setOperation("replace")}>Reemplazar</StockOperationButton>
              </div>
              <label className="grid gap-1 text-sm font-medium text-zinc-700" htmlFor={id}>
                Cantidad
          <input
            id={id}
            inputMode="numeric"
            value={value}
            onChange={(event) => { setValue(event.target.value); if (status === "error") setStatus("idle"); }}
            onKeyDown={(event) => { if (event.key === "Enter") saveStock(); }}
            aria-invalid={status === "error"}
            aria-describedby={status === "error" ? `${id}-error` : `${id}-helper`}
            className={cn("h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm", status === "error" && "border-sale")}
          />
              </label>
            </div>
          ) : null}
          <input className="h-10 rounded-xl border border-zinc-200 px-3 text-base outline-none md:text-sm" placeholder="Motivo opcional" value={reason} onChange={(event) => setReason(event.target.value)} aria-label={`Motivo de ajuste de ${productName}`} />
          <span id={`${id}-helper`} className="sr-only">Guardá el ajuste para actualizar stock.</span>
          {status === "error" ? <span id={`${id}-error`} className="text-xs font-medium text-sale">{error}</span> : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="h-10 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="button" className="h-10 rounded-xl bg-accent text-sm font-semibold text-on-accent" onClick={() => saveStock()}>{status === "saving" ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function StockOperationButton({ active, children, disabled = false, onClick }: { active: boolean; children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={cn("h-9 rounded-xl border px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", active ? "border-accent bg-accent text-on-accent" : "border-zinc-200 text-zinc-700 hover:border-accent")}>{children}</button>;
}
