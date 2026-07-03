"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useAdminProductsStore } from "@/stores/admin-products-store";
import { scrollToFirstError } from "@/components/admin/utils/scroll-to-error";
import { cn } from "@/lib/utils";
import { adminPrimitives } from "@/schemas/admin/shared";

type InlineStockCellProps = {
  productId: string;
  productName: string;
  initialStock: number | "infinite";
  variantId?: string;
};

type Status = "idle" | "saving" | "success" | "error";

const stockCellSchema = z
  .object({
    operation: z.enum(["add", "subtract", "replace"]),
    reason: z.string().trim().optional(),
    stockType: z.enum(["limited", "infinite"]),
    value: adminPrimitives.stock.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.stockType === "limited" && data.value === undefined) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Ingresá una cantidad para actualizar el stock" });
    }
  });

type StockCellInput = z.input<typeof stockCellSchema>;
type StockCellValues = z.infer<typeof stockCellSchema>;

function defaults(initialStock: number | "infinite"): StockCellInput {
  return {
    operation: "replace",
    reason: "",
    stockType: initialStock === "infinite" ? "infinite" : "limited",
    value: initialStock === "infinite" ? "" : String(initialStock),
  };
}

export function InlineStockCell({ initialStock, productId, productName, variantId }: InlineStockCellProps) {
  const id = useId();
  const updateInventoryStock = useAdminProductsStore((state) => state.updateInventoryStock);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<StockCellInput, unknown, StockCellValues>({
    defaultValues: defaults(initialStock),
    mode: "onBlur",
    resolver: zodResolver(stockCellSchema),
  });
  const { errors } = form.formState;
  const stockType = useWatch({ control: form.control, name: "stockType" });
  const operation = useWatch({ control: form.control, name: "operation" });
  const value = useWatch({ control: form.control, name: "value" }) as string | number | undefined;

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    form.reset(defaults(initialStock));
  }, [form, initialStock]);

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

  async function saveStock(values: StockCellValues) {
    const effectiveOperation = initialStock === "infinite" && values.stockType === "limited" ? "replace" : values.operation;
    setStatus("saving");
    setSubmitError("");
    try {
      const stockValue = values.value ?? 0;
      const computedStock = effectiveOperation === "add" ? currentStock + stockValue : effectiveOperation === "subtract" ? Math.max(0, currentStock - stockValue) : stockValue;
      await updateInventoryStock({ productId, variantId, stock: values.stockType === "infinite" ? "infinite" : computedStock, reason: values.reason || undefined });
      setStatus("success");
      setOpen(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus("idle"), 1200);
    } catch {
      setStatus("error");
      setSubmitError("No se pudo guardar el stock");
    }
  }

  function handleInvalidSubmit(formErrors: typeof errors) {
    setStatus("error");
    setSubmitError("Debes completar la cantidad correctamente.");
    scrollToFirstError(formErrors);
  }

  return (
    <div className="relative min-w-0 overflow-visible">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-label={`Editar stock de ${productName}`}
        onClick={() => {
          setSubmitError("");
          setStatus("idle");
          setOpen((current) => !current);
        }}
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
        <form ref={popoverRef} noValidate onSubmit={(event) => void form.handleSubmit(saveStock, handleInvalidSubmit)(event)} className="z-50 grid w-[min(20rem,calc(100vw-2rem))] gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl" style={{ position: "absolute", top: popoverPosition.top, left: popoverPosition.left }}>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-zinc-950">Tipo de stock</legend>
            <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="radio" value="infinite" {...form.register("stockType")} /> Infinito</label>
            <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="radio" value="limited" {...form.register("stockType", { onChange: () => { if (initialStock === "infinite") form.setValue("operation", "replace", { shouldDirty: true, shouldValidate: true }); } })} /> Limitado</label>
          </fieldset>
          {stockType === "limited" ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-2">
                <StockOperationButton disabled={initialStock === "infinite"} active={operation === "add"} onClick={() => form.setValue("operation", "add", { shouldDirty: true, shouldValidate: true })}>Agregar</StockOperationButton>
                <StockOperationButton disabled={initialStock === "infinite"} active={operation === "subtract"} onClick={() => form.setValue("operation", "subtract", { shouldDirty: true, shouldValidate: true })}>Descontar</StockOperationButton>
                <StockOperationButton active={operation === "replace"} onClick={() => form.setValue("operation", "replace", { shouldDirty: true, shouldValidate: true })}>Reemplazar</StockOperationButton>
              </div>
              <label className="grid gap-1 text-sm font-medium text-zinc-700" htmlFor={id}>
                Cantidad
          <input
             id={id}
             inputMode="numeric"
             value={value ?? ""}
             onBlur={() => void form.trigger("value")}
             onChange={(event) => { form.setValue("value", event.target.value, { shouldDirty: true, shouldValidate: true }); if (status === "error") setStatus("idle"); }}
             aria-invalid={errors.value ? true : undefined}
             aria-describedby={errors.value ? `${id}-error` : `${id}-helper`}
             className={cn("h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm", errors.value && "border-sale")}
           />
              </label>
            </div>
          ) : null}
          <label className="grid gap-1 text-sm font-medium text-zinc-700" htmlFor={`${id}-reason`}>
            Motivo opcional
            <input id={`${id}-reason`} className="h-10 rounded-xl border border-zinc-200 px-3 text-base outline-none md:text-sm" aria-describedby={`${id}-reason-helper`} {...form.register("reason")} />
          </label>
          <span id={`${id}-reason-helper`} className="sr-only">Motivo interno para el ajuste de {productName}.</span>
          <span id={`${id}-helper`} className="sr-only">Guardá el ajuste para actualizar stock.</span>
          {errors.value || submitError ? <span id={`${id}-error`} className="text-xs font-medium text-sale">{errors.value?.message ?? submitError}</span> : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="h-10 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="h-10 rounded-xl bg-accent text-sm font-semibold text-on-accent" disabled={status === "saving"}>{status === "saving" ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>,
        document.body,
      ) : null}
    </div>
  );
}

function StockOperationButton({ active, children, disabled = false, onClick }: { active: boolean; children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={cn("h-9 rounded-xl border px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", active ? "border-accent bg-accent text-on-accent" : "border-zinc-200 text-zinc-700 hover:border-accent")}>{children}</button>;
}
