import { ProductCard } from "@/components/shop/products/ProductCard";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types/product";

type ProductGridProps = {
  products: ProductSummary[];
  columns?: "listing" | "featured";
  cardDensity?: "standard" | "compactMobile";
};

const columnStyles = {
  listing: "grid-cols-2 lg:grid-cols-4",
  featured: "grid-cols-2 lg:grid-cols-5",
};

export function ProductGrid({ products, columns = "listing", cardDensity = "standard" }: ProductGridProps) {
  return (
    <div className={cn("grid gap-5", columnStyles[columns])}>
      {products.map((product) => (
        <ProductCard density={cardDensity} key={product.id} product={product} />
      ))}
    </div>
  );
}
