import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ProductVisual } from "@/components/shop/products/ProductVisual";
import { getProductImage } from "@/lib/cart-items";
import { formatCurrency } from "@/lib/pricing";
import { getProductHref } from "@/lib/routes";
import type { WishlistProduct } from "@/types/account";

type WishlistProductCardProps = {
  product: WishlistProduct;
  onRemove: (productId: string) => void | Promise<boolean>;
  pending: boolean;
};

export function WishlistProductCard({ product, onRemove, pending }: WishlistProductCardProps) {
  const image = getProductImage(product.images);

  return (
    <article className="grid overflow-hidden rounded-card border border-border bg-white shadow-card">
      {image ? (
        // Match ProductCard's persisted-media rendering; the placeholder remains the fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={image.alt || product.name}
          className="aspect-[4/3] w-full bg-white object-contain p-4"
          loading="lazy"
          src={image.url}
        />
      ) : (
        <ProductVisual
          brand={product.brand}
          className="aspect-[4/3] rounded-none bg-white"
          name={product.name}
          tone={product.imageTone}
        />
      )}
      <div className="grid gap-3 p-4">
        <div>
          <p className="text-xs font-bold uppercase text-text-muted">{product.brand}</p>
          <h3 className="mt-1 font-subtitle text-xl font-semibold leading-6">{product.name}</h3>
        </div>
        <p className="font-subtitle text-xl font-bold">{formatCurrency(product.price)}</p>
        <div className="grid gap-2">
          <Button data-quick-buy-product-slug={product.slug}>Añadir al carrito</Button>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-button border border-border bg-surface px-5 font-subtitle text-sm font-semibold uppercase transition hover:border-text"
            href={getProductHref(product.slug)}
          >
            Info del Producto
          </Link>
          <Button
            aria-busy={pending}
            disabled={pending}
            onClick={() => void onRemove(product.id)}
            variant="danger"
          >
            {pending ? "Quitando..." : "Eliminar"}
          </Button>
        </div>
      </div>
    </article>
  );
}
