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
  const { register, setValue } = useFormContext<ProductCreateInput>();
  const categoryId = useWatch<ProductCreateInput, "categoryId">({ name: "categoryId" });
  const tags = useWatch<ProductCreateInput, "tags">({ name: "tags" });
  const brand = useWatch<ProductCreateInput, "brand">({ name: "brand" });
  const highlightSections = useWatch<ProductCreateInput, "highlightSections">({ name: "highlightSections" }) ?? [];
  const variantProperties = useWatch<ProductCreateInput, "variantProperties">({ name: "variantProperties" }) ?? [];
  const variantCombinations = useWatch<ProductCreateInput, "variantCombinations">({ name: "variantCombinations" }) ?? [];
  const selectedCategory = categories.find((category) => category.id === categoryId);

  function updateVariantProperty(index: number, field: "name" | "values", value: string) {
    const next = [...variantProperties];
    next[index] = {
      ...next[index],
      [field]: field === "values" ? value.split(",").map((item) => item.trim()).filter(Boolean) : value,
    };
    setValue("variantProperties", next, { shouldDirty: true, shouldValidate: true });
    setValue("variantCombinations", buildCombinations(next), { shouldDirty: true, shouldValidate: true });
  }

  return (
    <ProductFormCard id="product-drawers-section" title="Opciones avanzadas" description="Usá paneles para categoría, variantes, etiquetas, SEO y destacados.">
      <div className="grid gap-3 md:grid-cols-2">
        <DrawerButton icon={<FolderTree aria-hidden size={18} />} label="Categoría" value={selectedCategory?.name ?? "Sin categoría"} onClick={() => setOpenDrawer("category")} />
        <DrawerButton icon={<Layers3 aria-hidden size={18} />} label="Variantes" value={`${variantCombinations.length} combinaciones`} onClick={() => setOpenDrawer("variants")} />
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
            {variantProperties.map((property, index) => (
              <div key={index} className="grid gap-3 rounded-2xl border border-zinc-200 p-3">
                <Input id={`variant-name-${index}`} label="Propiedad" helperText="Ejemplo: Color, Talle o Sabor." value={property.name} onChange={(event) => updateVariantProperty(index, "name", event.target.value)} />
                <Input id={`variant-values-${index}`} label="Valores" helperText="Separá valores personalizados con coma." value={property.values.join(", ")} onChange={(event) => updateVariantProperty(index, "values", event.target.value)} />
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => setValue("variantProperties", [...variantProperties, { name: "", values: [] }], { shouldDirty: true, shouldValidate: true })}>Agregar propiedad</Button>
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold text-zinc-950">Combinaciones generadas</h3>
              {variantCombinations.length ? variantCombinations.map((combo) => <p key={combo.id} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">{combo.name} · {combo.sku}</p>) : <p className="text-sm text-zinc-500">Agregá propiedades y valores para generar combinaciones.</p>}
            </div>
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
