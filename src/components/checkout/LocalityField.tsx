"use client";

import { MapPin } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/Input";
import { CHECKOUT_LOCALITY_MODE, type DeliveryForm } from "@/components/checkout/checkout-form.validators";
import {
  loadProvinceLocalities,
  searchLocalities,
  type CheckoutLocality,
} from "@/lib/data/locations/localities";
import { cn } from "@/lib/utils";

export type LocalityFieldProps = {
  errorText?: string;
  form: Pick<DeliveryForm, "city" | "localityId" | "localityMode" | "provinceId">;
  onBlur: () => void;
  onManualChange: (value: string) => void;
  onModeChange: (mode: DeliveryForm["localityMode"]) => void;
  onSelect: (locality: CheckoutLocality) => void;
};

type LoadState = { localities: readonly CheckoutLocality[]; provinceId: string; status: "error" | "ready" };

const LISTBOX_ID = "checkout-locality-listbox";

export function LocalityField({ errorText, form, onBlur, onManualChange, onModeChange, onSelect }: LocalityFieldProps) {
  const [loaded, setLoaded] = useState<LoadState | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const manual = form.localityMode === CHECKOUT_LOCALITY_MODE.MANUAL;

  useEffect(() => {
    const provinceId = form.provinceId ?? "";
    if (!provinceId || manual) return;
    let cancelled = false;
    loadProvinceLocalities(provinceId)
      .then((localities) => { if (!cancelled) setLoaded({ localities, provinceId, status: "ready" }); })
      .catch(() => { if (!cancelled) setLoaded({ localities: [], provinceId, status: "error" }); });
    return () => { cancelled = true; };
  }, [form.provinceId, manual]);

  const current = loaded?.provinceId === form.provinceId ? loaded : null;
  const results = useMemo(
    () => (current ? searchLocalities(current.localities, query ?? "") : []),
    [current, query],
  );

  if (manual) {
    return (
      <div className="grid gap-2">
        <Input
          errorText={errorText}
          helperText="Localidad ingresada manualmente: no proviene del listado oficial."
          id="checkout-city"
          label="Localidad (ingreso manual)*"
          onBlur={onBlur}
          onChange={(event) => onManualChange(event.target.value)}
          trailingIcon={<MapPin aria-hidden size={16} />}
          value={form.city}
        />
        <button
          className="justify-self-start text-xs font-semibold text-accent-hover underline underline-offset-2"
          onClick={() => onModeChange(CHECKOUT_LOCALITY_MODE.OFFICIAL)}
          type="button"
        >
          Buscar en el listado oficial
        </button>
      </div>
    );
  }

  const disabled = !form.provinceId;
  const loading = Boolean(form.provinceId) && !current;
  const helperText = disabled
    ? "Elegí primero una provincia."
    : loading
      ? "Cargando localidades…"
      : current?.status === "error"
        ? "No pudimos cargar el listado. Podés ingresar la localidad manualmente."
        : "Buscá y elegí tu localidad del listado oficial (Georef).";

  function choose(locality: CheckoutLocality) {
    onSelect(locality);
    setQuery(null);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" && open && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative grid gap-2">
      <Input
        aria-activedescendant={open && results[activeIndex] ? `checkout-locality-option-${results[activeIndex].id}` : undefined}
        aria-autocomplete="list"
        aria-controls={LISTBOX_ID}
        aria-expanded={open}
        autoComplete="off"
        disabled={disabled}
        errorText={errorText}
        helperText={helperText}
        id="checkout-city"
        label="Localidad*"
        onBlur={() => { setOpen(false); setQuery(null); onBlur(); }}
        onChange={(event) => {
          if (form.localityId) onModeChange(CHECKOUT_LOCALITY_MODE.OFFICIAL);
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        role="combobox"
        trailingIcon={<MapPin aria-hidden size={16} />}
        value={query ?? form.city}
      />
      {open && results.length > 0 ? (
        <ul
          className="absolute left-0 right-0 top-[4.5rem] z-20 max-h-56 overflow-y-auto rounded-card border border-border bg-surface py-1 shadow-card"
          id={LISTBOX_ID}
          role="listbox"
        >
          {results.map((locality, index) => (
            <li
              aria-selected={index === activeIndex}
              className={cn("cursor-pointer px-3 py-2 text-sm text-text hover:bg-accent-soft", index === activeIndex && "bg-accent-soft")}
              id={`checkout-locality-option-${locality.id}`}
              key={locality.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(locality)}
              role="option"
            >
              {locality.name}
            </li>
          ))}
        </ul>
      ) : null}
      {!disabled && !loading ? (
        <button
          className="justify-self-start text-xs font-semibold text-accent-hover underline underline-offset-2"
          onClick={() => onModeChange(CHECKOUT_LOCALITY_MODE.MANUAL)}
          type="button"
        >
          No encuentro mi localidad
        </button>
      ) : null}
    </div>
  );
}
