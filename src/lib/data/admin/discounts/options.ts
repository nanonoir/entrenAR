import { getCatalogRepository, type CatalogRepository } from "@/lib/api/catalog/catalog.repository";
import { shippingProviderDefinitions } from "@/lib/data/admin/shipping/shipping-config";
import { getArgentineShippingProvinces } from "@/lib/data/admin/shipping/provinces";
import type { DiscountSelectOption } from "@/types/discount";

type DiscountCatalogRepository = Pick<CatalogRepository, "getAdminCategories" | "getAdminProducts">;

export async function getDiscountProductOptions(repository: DiscountCatalogRepository = getCatalogRepository()): Promise<DiscountSelectOption[]> {
  try {
    const result = await repository.getAdminProducts();
    const products = result.status === "success" || result.status === "empty" ? result.data : [];
    return products.map((product) => ({ id: product.id, label: product.name, description: product.categoryName }));
  } catch {
    return [];
  }
}

export async function getDiscountCategoryOptions(repository: DiscountCatalogRepository = getCatalogRepository()): Promise<DiscountSelectOption[]> {
  try {
    const result = await repository.getAdminCategories();
    const categories = result.status === "success" || result.status === "empty" ? result.data : [];
    return categories.map((category) => ({ id: category.id, label: category.name, description: category.parentId ? "Subcategoría" : "Categoría" }));
  } catch {
    return [];
  }
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
