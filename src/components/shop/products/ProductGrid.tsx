import { ProductCard } from "@/components/shop/products/ProductCard";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types/product";

type ProductGridProps = {
  products: ProductSummary[];
  columns?: "listing" | "featured";
};

const columnStyles = {
  listing: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  featured: "sm:grid-cols-2 lg:grid-cols-5",
};

export function ProductGrid({ products, columns = "listing" }: ProductGridProps) {
  return (
    <div className={cn("grid gap-5", columnStyles[columns])}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
