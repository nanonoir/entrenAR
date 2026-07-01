import { getAdminProductCategories, getAdminProducts } from "@/lib/data/admin/sales-flow/mock-products";
import { shippingProviderDefinitions } from "@/lib/data/admin/shipping/shipping-config";
import { getArgentineShippingProvinces } from "@/lib/data/admin/shipping/provinces";
import type { DiscountSelectOption } from "@/lib/data/admin/discounts/types";

export async function getDiscountProductOptions(): Promise<DiscountSelectOption[]> {
  const products = await getAdminProducts();
  return products.map((product) => ({ id: product.id, label: product.name, description: product.categoryName }));
}

export async function getDiscountCategoryOptions(): Promise<DiscountSelectOption[]> {
  const categories = await getAdminProductCategories();
  return categories.map((category) => ({ id: category.id, label: category.name, description: category.parentId ? "Subcategoría" : "Categoría" }));
}

export async function getDiscountShippingMethodOptions(): Promise<DiscountSelectOption[]> {
  return shippingProviderDefinitions.flatMap((provider) =>
    provider.services.map((service) => ({
      id: `${provider.id}:${service.toLowerCase().replaceAll(" ", "-")}`,
      label: `${provider.name} - ${service}`,
      description: provider.name,
    })),
  );
}

export async function getDiscountZoneOptions(): Promise<DiscountSelectOption[]> {
  return getArgentineShippingProvinces();
}
