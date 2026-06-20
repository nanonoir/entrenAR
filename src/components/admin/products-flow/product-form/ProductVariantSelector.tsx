"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getProductVariantPresetValues, productVariantPresets } from "@/lib/data/admin/product-variant-presets";

type VariantProperty = { name: string; values: string[] };

type ProductVariantSelectorProps = {
  blockedName?: string;
  customValue: string;
  isCustomDraft?: boolean;
  label: string;
  property?: VariantProperty;
  onAddCustomValue: () => void;
  onCustomNameChange: (value: string) => void;
  onCustomValueChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onToggleValue: (value: string) => void;
};

export function ProductVariantSelector({ blockedName, customValue, isCustomDraft = false, label, onAddCustomValue, onCustomNameChange, onCustomValueChange, onNameChange, onToggleValue, property }: ProductVariantSelectorProps) {
  const hasPropertyName = Boolean(property?.name);
  const isCustom = hasPropertyName && !productVariantPresets.some((preset) => preset.name === property?.name);
  const selectedValue = isCustomDraft || isCustom ? "__custom__" : property?.name ?? "";
  const presetValues = property?.name ? getProductVariantPresetValues(property.name) : [];
  const propertyValues = property?.values ?? [];
  const visibleValues = Array.from(new Set([...presetValues, ...propertyValues]));

  return (
    <section className="grid gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <label className="grid gap-2 text-sm font-medium text-text">
        {label}
        <select value={selectedValue} onChange={(event) => onNameChange(event.target.value)} className="h-11 rounded-button border border-border bg-surface px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm">
          <option value="">Selecciona una opción</option>
          {productVariantPresets.map((preset) => <option key={preset.name} value={preset.name} disabled={blockedName === preset.name}>{preset.name}</option>)}
          <option value="__custom__">+ Nueva variante</option>
        </select>
      </label>
      {selectedValue === "__custom__" ? <Input id={`custom-${label}`} label="Nombre de la variante" helperText="Ejemplo: Dimensiones" value={property?.name ?? ""} onChange={(event) => onCustomNameChange(event.target.value)} /> : null}
      {hasPropertyName ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-text">Valores</legend>
          {visibleValues.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" checked={propertyValues.includes(value)} onChange={() => onToggleValue(value)} className="shrink-0" />
              {value}
            </label>
          ))}
        </fieldset>
      ) : null}
      {hasPropertyName ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input id={`custom-value-${label}`} label="Valor personalizado" helperText="Ejemplo: Pistacho o 40x10cm" value={customValue} onChange={(event) => onCustomValueChange(event.target.value)} />
          <Button className="self-end" type="button" variant="secondary" onClick={onAddCustomValue}>Agregar valor personalizado</Button>
        </div>
      ) : null}
    </section>
  );
}
