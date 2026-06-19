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

type DrawerType = "category" | "variants" | "metadata" | "highlights" | null;

type ProductAdvancedDrawersCardProps = {
  categories: AdminProductCategory[];
};

const highlightOptions = [
  { id: "home", label: "Inicio" },
  { id: "featured", label: "Destacados" },
  { id: "seasonal", label: "Temporada" },
];

const variantPresetCatalog: Record<string, string[]> = {
  Sabor: ["Chocolate", "Vainilla", "Frutilla"],
  Color: ["Negro", "Blanco", "Rojo", "Azul"],
  Talle: ["S", "M", "L", "XL"],
  Tamaño: ["Chico", "Mediano", "Grande"],
};

function buildCombinations(properties: Array<{ name: string; values: string[] }>) {
  if (properties.length === 0) return [];
  const combos = properties.reduce<string[][]>((acc, property) => {
    if (acc.length === 0) return property.values.map((value) => [value]);
    return acc.flatMap((combo) => property.values.map((value) => [...combo, value]));
  }, []);
  return combos.map((combo, index) => ({
    id: `combo-${index + 1}`,
    name: combo.join(" / "),
    sku: `VAR-${String(index + 1).padStart(3, "0")}`,
    stock: 0,
  }));
}

export function ProductAdvancedDrawersCard({ categories }: ProductAdvancedDrawersCardProps) {
  const [openDrawer, setOpenDrawer] = useState<DrawerType>(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const { register, setValue } = useFormContext<ProductCreateInput>();
  const categoryId = useWatch<ProductCreateInput, "categoryId">({ name: "categoryId" });
  const tags = useWatch<ProductCreateInput, "tags">({ name: "tags" });
  const brand = useWatch<ProductCreateInput, "brand">({ name: "brand" });
  const highlightSections = useWatch<ProductCreateInput, "highlightSections">({ name: "highlightSections" }) ?? [];
  const variantProperties = useWatch<ProductCreateInput, "variantProperties">({ name: "variantProperties" }) ?? [];
  const selectedCategory = categories.find((category) => category.id === categoryId);

  function syncVariantProperties(next: Array<{ name: string; values: string[] }>) {
    setValue("variantProperties", next, { shouldDirty: true, shouldValidate: true });
    setValue("variantCombinations", buildCombinations(next), { shouldDirty: true, shouldValidate: true });
  }

  function ensureVariantProperty(name: string) {
    if (variantProperties.some((property) => property.name === name)) return;
    syncVariantProperties([...variantProperties, { name, values: [] }]);
  }

  function toggleVariantValue(propertyName: string, option: string) {
    const next = variantProperties.map((property) => {
      if (property.name !== propertyName) return property;
      return {
        ...property,
        values: property.values.includes(option)
          ? property.values.filter((value) => value !== option)
          : [...property.values, option],
      };
    });
    syncVariantProperties(next);
  }

  function addCustomVariantValue(propertyName: string) {
    const value = customValues[propertyName]?.trim();
    if (!value) return;
    const next = variantProperties.map((property) => property.name === propertyName && !property.values.includes(value)
      ? { ...property, values: [...property.values, value] }
      : property);
    syncVariantProperties(next);
    setCustomValues((current) => ({ ...current, [propertyName]: "" }));
  }

  return (
    <ProductFormCard id="product-drawers-section" title="Opciones avanzadas" description="Usá paneles para categoría, variantes, etiquetas, SEO y destacados.">
      <div className="grid gap-3 md:grid-cols-2">
        <DrawerButton icon={<FolderTree aria-hidden size={18} />} label="Categoría" value={selectedCategory?.name ?? "Sin categoría"} onClick={() => setOpenDrawer("category")} />
        <DrawerButton icon={<Layers3 aria-hidden size={18} />} label="Variantes" value={variantProperties.length ? `${variantProperties.length} propiedades` : "Sin variantes"} onClick={() => setOpenDrawer("variants")} />
        <DrawerButton icon={<Tags aria-hidden size={18} />} label="Marca y etiquetas" value={[brand, tags].filter(Boolean).join(" · ") || "Sin datos"} onClick={() => setOpenDrawer("metadata")} />
        <DrawerButton icon={<Sparkles aria-hidden size={18} />} label="Destacados" value={highlightSections.length ? `${highlightSections.length} secciones` : "Sin destacar"} onClick={() => setOpenDrawer("highlights")} />
      </div>

      <Drawer open={openDrawer === "category"} title="Seleccionar categoría" className="flex flex-col h-full min-h-0" onClose={() => setOpenDrawer(null)}>
        <DrawerBody>
          <div className="grid gap-2">
            {categories.map((category) => (
              <button key={category.id} type="button" onClick={() => { setValue("categoryId", category.id, { shouldDirty: true, shouldValidate: true }); setOpenDrawer(null); }} className="rounded-2xl border border-zinc-200 p-3 text-left text-sm font-semibold text-zinc-700 hover:border-accent">
                {category.name}
              </button>
            ))}
          </div>
        </DrawerBody>
      </Drawer>

      <Drawer open={openDrawer === "variants"} title="Variantes" className="flex flex-col h-full min-h-0" onClose={() => setOpenDrawer(null)}>
        <DrawerBody footer={<Button onClick={() => setOpenDrawer(null)}>Listo</Button>}>
          <div className="grid gap-4">
            <fieldset className="grid gap-2">
              <legend className="text-sm font-semibold text-zinc-950">Propiedades</legend>
              <div className="flex flex-wrap gap-2">
                {Object.keys(variantPresetCatalog).map((propertyName) => (
                  <button
                    key={propertyName}
                    type="button"
                    onClick={() => ensureVariantProperty(propertyName)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${variantProperties.some((property) => property.name === propertyName) ? "border-accent bg-accent text-on-accent" : "border-zinc-200 text-zinc-700 hover:border-accent"}`}
                  >
                    {propertyName}
                  </button>
                ))}
              </div>
            </fieldset>
            {variantProperties.map((property) => (
              <div key={property.name} className="grid gap-3 rounded-2xl border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-zinc-950">{property.name}</h3>
                  <button type="button" className="text-sm font-semibold text-sale" onClick={() => syncVariantProperties(variantProperties.filter((item) => item.name !== property.name))}>Quitar</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(variantPresetCatalog[property.name] ?? []).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleVariantValue(property.name, option)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${property.values.includes(option) ? "border-accent bg-accent text-on-accent" : "border-zinc-200 text-zinc-700 hover:border-accent"}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {property.values.length > 0 ? <div className="flex flex-wrap gap-2">{property.values.map((value) => <span key={value} className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">{value}</span>)}</div> : null}
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input id={`custom-${property.name}`} label="Valor personalizado" helperText="Ejemplo: Pistacho" value={customValues[property.name] ?? ""} onChange={(event) => setCustomValues((current) => ({ ...current, [property.name]: event.target.value }))} />
                  <Button className="self-end" type="button" variant="secondary" onClick={() => addCustomVariantValue(property.name)}>Agregar valor personalizado</Button>
                </div>
              </div>
            ))}
            <p className="text-sm text-zinc-500">Las combinaciones se preparan automáticamente para inventario y edición, sin mostrarse en este panel.</p>
          </div>
        </DrawerBody>
      </Drawer>

      <Drawer open={openDrawer === "metadata"} title="Marca, etiquetas y SEO" className="flex flex-col h-full min-h-0" onClose={() => setOpenDrawer(null)}>
        <DrawerBody footer={<Button onClick={() => setOpenDrawer(null)}>Guardar panel</Button>}>
          <Input id="drawer-brand" label="Marca" helperText="Opcional para filtros y edición futura." {...register("brand")} />
          <Input id="drawer-tags" label="Etiquetas" helperText="Separá etiquetas con coma." {...register("tags")} />
          <Input id="drawer-slug" label="Slug público" helperText="Opcional. Si lo dejás vacío se genera desde el nombre." {...register("slug")} />
          <Input id="drawer-seo-title" label="Título SEO" helperText="Máximo 70 caracteres." trailingIcon={<Search aria-hidden size={14} />} {...register("seoTitle")} />
          <Textarea id="drawer-seo-description" label="Descripción SEO" helperText="Máximo 160 caracteres." {...register("seoDescription")} />
        </DrawerBody>
      </Drawer>

      <Drawer open={openDrawer === "highlights"} title="Secciones destacadas" className="flex flex-col h-full min-h-0" onClose={() => setOpenDrawer(null)}>
        <DrawerBody footer={<Button onClick={() => setOpenDrawer(null)}>Aplicar</Button>}>
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
  return <div className="flex flex-col h-full min-h-0"><div className="grid flex-1 gap-4 overflow-y-auto p-4">{children}</div><div className="shrink-0 border-t border-zinc-200 p-4">{footer}</div></div>;
}
