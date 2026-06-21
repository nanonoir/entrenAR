"use client";

import { FolderTree, Layers3, Search, Sparkles, Tags } from "lucide-react";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { AdminProductCategory } from "@/lib/data/admin/sales-flow/mock-products";
import type { ProductCreateInput } from "@/schemas/admin/product-schemas";
import { ProductFormCard } from "@/components/admin/products-flow/product-form/ProductFormField";
import { ProductCategoryList } from "@/components/admin/products-flow/product-form/ProductCategoryList";
import { ProductVariantSelector } from "@/components/admin/products-flow/product-form/ProductVariantSelector";
import { buildCombinations, getActiveVariantProperties, type ProductVariantPropertyDraft } from "@/lib/data/admin/product-variant-utils";

export type ProductAdvancedDrawerType = "category" | "variants" | "metadata" | "highlights" | null;

type ProductAdvancedDrawersCardProps = {
  categories: AdminProductCategory[];
  openDrawer: ProductAdvancedDrawerType;
  onCreateCategory: (name: string) => AdminProductCategory;
  onOpenDrawerChange: (drawer: ProductAdvancedDrawerType) => void;
};

const highlightOptions = [
  { id: "home", label: "Inicio" },
  { id: "featured", label: "Destacados" },
  { id: "seasonal", label: "Temporada" },
];

export function ProductAdvancedDrawersCard({ categories, onCreateCategory, onOpenDrawerChange, openDrawer }: ProductAdvancedDrawersCardProps) {
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [customPropertyDrafts, setCustomPropertyDrafts] = useState<Record<string, boolean>>({});
  const { getValues, register, setValue } = useFormContext<ProductCreateInput>();
  const categoryIds = useWatch<ProductCreateInput, "categoryIds">({ name: "categoryIds" }) ?? [];
  const tags = useWatch<ProductCreateInput, "tags">({ name: "tags" });
  const brand = useWatch<ProductCreateInput, "brand">({ name: "brand" });
  const highlightSections = useWatch<ProductCreateInput, "highlightSections">({ name: "highlightSections" }) ?? [];
  const variantProperties = useWatch<ProductCreateInput, "variantProperties">({ name: "variantProperties" }) ?? [];
  const activeVariantProperties = getActiveVariantProperties(variantProperties);
  const selectedCategoryNames = categories.filter((category) => categoryIds.includes(category.id)).map((category) => category.name);

  function syncVariantProperties(next: ProductVariantPropertyDraft[]) {
    const namedProperties = next.filter((property) => property.name.trim() !== "").slice(0, 2);
    setValue("variantProperties", namedProperties, { shouldDirty: true, shouldValidate: true });
    setValue("variantCombinations", buildCombinations(namedProperties, getValues("variantCombinations") ?? []), { shouldDirty: true, shouldValidate: true });
  }

  function replaceVariantPropertyAtIndex(properties: ProductVariantPropertyDraft[], index: number, property: ProductVariantPropertyDraft) {
    if (index === 0) return [property, ...properties.slice(1)].slice(0, 2);
    return properties[0] ? [properties[0], property].slice(0, 2) : [property];
  }

  function setVariantProperty(index: number, name: string) {
    setCustomPropertyDrafts((current) => ({ ...current, [index]: name === "__custom__" }));
    let next = [...variantProperties];
    if (!name || name === "__custom__") {
      next.splice(index, 1);
      syncVariantProperties(next);
      return;
    }
    next = replaceVariantPropertyAtIndex(next, index, { name, values: [] });
    next = next.filter((property, propertyIndex) => propertyIndex === index || property.name.trim().toLowerCase() !== name.trim().toLowerCase());
    syncVariantProperties(next);
  }

  function updateCustomPropertyName(index: number, name: string) {
    let next = [...variantProperties];
    const trimmedName = name.trim();
    if (!trimmedName) {
      next.splice(index, 1);
      syncVariantProperties(next);
      return;
    }
    next = replaceVariantPropertyAtIndex(next, index, { ...(next[index] ?? { values: [] }), name: trimmedName });
    const normalizedName = name.trim().toLowerCase();
    if (normalizedName) next = next.filter((property, propertyIndex) => propertyIndex === index || property.name.trim().toLowerCase() !== normalizedName);
    syncVariantProperties(next);
  }

  function toggleVariantValue(index: number, option: string) {
    const next = variantProperties.map((property, propertyIndex) => {
      if (propertyIndex !== index) return property;
      return {
        ...property,
        values: property.values.includes(option)
          ? property.values.filter((value) => value !== option)
          : [...property.values, option],
      };
    });
    syncVariantProperties(next);
  }

  function addCustomVariantValue(index: number) {
    const key = String(index);
    const value = customValues[key]?.trim();
    if (!value) return;
    const next = variantProperties.map((property, propertyIndex) => propertyIndex === index && !property.values.includes(value)
      ? { ...property, values: [...property.values, value] }
      : property);
    syncVariantProperties(next);
    setCustomValues((current) => ({ ...current, [key]: "" }));
  }

  return (
    <ProductFormCard id="product-drawers-section" title="Opciones avanzadas" description="Usá paneles para categoría, variantes, etiquetas, SEO y destacados.">
      <div className="grid gap-3 md:grid-cols-2">
        <DrawerButton icon={<FolderTree aria-hidden size={18} />} label="Categoría" value={selectedCategoryNames.length ? selectedCategoryNames.join(", ") : "Sin categoría"} onClick={() => onOpenDrawerChange("category")} />
        <DrawerButton icon={<Layers3 aria-hidden size={18} />} label="Variantes" value={activeVariantProperties.length ? `${activeVariantProperties.length} propiedades` : "Sin variantes"} onClick={() => onOpenDrawerChange("variants")} />
        <DrawerButton icon={<Tags aria-hidden size={18} />} label="Marca y etiquetas" value={[brand, tags].filter(Boolean).join(" · ") || "Sin datos"} onClick={() => onOpenDrawerChange("metadata")} />
        <DrawerButton icon={<Sparkles aria-hidden size={18} />} label="Destacados" value={highlightSections.length ? `${highlightSections.length} secciones` : "Sin destacar"} onClick={() => onOpenDrawerChange("highlights")} />
      </div>

      <Drawer open={openDrawer === "category"} title="Seleccionar categoría" className="flex flex-col h-full min-h-0" onClose={() => onOpenDrawerChange(null)}>
        <DrawerBody>
          <ProductCategoryList categories={categories} selectedIds={categoryIds} onCreateCategory={onCreateCategory} onChange={(ids) => setValue("categoryIds", ids, { shouldDirty: true, shouldValidate: true })} />
        </DrawerBody>
      </Drawer>

      <Drawer open={openDrawer === "variants"} title="Variantes" className="flex flex-col h-full min-h-0" onClose={() => onOpenDrawerChange(null)}>
        <DrawerBody footer={<Button onClick={() => onOpenDrawerChange(null)}>Listo</Button>}>
          <div className="grid gap-4">
            <ProductVariantSelector label="Variante" property={variantProperties[0]} blockedName={variantProperties[1]?.name} customValue={customValues["0"] ?? ""} isCustomDraft={customPropertyDrafts["0"]} onCustomNameChange={(value) => updateCustomPropertyName(0, value)} onCustomValueChange={(value) => setCustomValues((current) => ({ ...current, 0: value }))} onNameChange={(value) => setVariantProperty(0, value)} onToggleValue={(value) => toggleVariantValue(0, value)} onAddCustomValue={() => addCustomVariantValue(0)} />
            <ProductVariantSelector label="Subvariante" property={variantProperties[1]} blockedName={variantProperties[0]?.name} customValue={customValues["1"] ?? ""} isCustomDraft={customPropertyDrafts["1"]} onCustomNameChange={(value) => updateCustomPropertyName(1, value)} onCustomValueChange={(value) => setCustomValues((current) => ({ ...current, 1: value }))} onNameChange={(value) => setVariantProperty(1, value)} onToggleValue={(value) => toggleVariantValue(1, value)} onAddCustomValue={() => addCustomVariantValue(1)} />
          </div>
        </DrawerBody>
      </Drawer>

      <Drawer open={openDrawer === "metadata"} title="Marca, etiquetas y SEO" className="flex flex-col h-full min-h-0" onClose={() => onOpenDrawerChange(null)}>
        <DrawerBody footer={<Button onClick={() => onOpenDrawerChange(null)}>Guardar panel</Button>}>
          <Input id="drawer-brand" label="Marca" helperText="Opcional para filtros y edición futura." {...register("brand")} />
          <Input id="drawer-tags" label="Etiquetas" helperText="Separá etiquetas con coma." {...register("tags")} />
          <Input id="drawer-slug" label="Slug público" helperText="Opcional. Si lo dejás vacío se genera desde el nombre." {...register("slug")} />
          <Input id="drawer-seo-title" label="Título SEO" helperText="Máximo 70 caracteres." trailingIcon={<Search aria-hidden size={14} />} {...register("seoTitle")} />
          <Textarea id="drawer-seo-description" label="Descripción SEO" helperText="Máximo 160 caracteres." {...register("seoDescription")} />
        </DrawerBody>
      </Drawer>

      <Drawer open={openDrawer === "highlights"} title="Secciones destacadas" className="flex flex-col h-full min-h-0" onClose={() => onOpenDrawerChange(null)}>
        <DrawerBody footer={<Button onClick={() => onOpenDrawerChange(null)}>Aplicar</Button>}>
          {highlightOptions.map((option) => {
            const checked = highlightSections.includes(option.id);
            return (
              <label key={option.id} className="flex items-center gap-2 rounded-2xl border border-zinc-200 p-3 text-sm font-medium text-zinc-700">
                <input type="checkbox" checked={checked} onChange={() => setValue("highlightSections", checked ? highlightSections.filter((id) => id !== option.id) : [...highlightSections, option.id], { shouldDirty: true, shouldValidate: true })} />
                {option.label}
              </label>
            );
          })}
        </DrawerBody>
      </Drawer>
    </ProductFormCard>
  );
}

function DrawerButton({ icon, label, onClick, value }: { icon: React.ReactNode; label: string; onClick: () => void; value: string }) {
  return <button type="button" onClick={onClick} className="flex min-w-0 items-center gap-3 rounded-2xl border border-zinc-200 p-3 text-left transition hover:border-accent"><span className="shrink-0 text-accent">{icon}</span><span className="min-w-0"><span className="block font-semibold text-zinc-950">{label}</span><span className="block truncate text-sm text-zinc-500">{value}</span></span></button>;
}

function DrawerBody({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return <div className="flex flex-col h-full min-h-0"><div className="flex-1 overflow-y-auto p-4">{children}</div>{footer ? <div className="shrink-0 border-t border-zinc-200 p-4">{footer}</div> : null}</div>;
}
