"use client";

import { Modal } from "@/components/ui/Modal";
import { QuickBuyProductConfigurator } from "@/components/shop/quick-buy/QuickBuyProductConfigurator";
import type { CartPreviewItem } from "@/types/cart";
import type { QuickBuyProduct } from "@/types/product";

type ProductModalProps = {
  open: boolean;
  product: QuickBuyProduct | null;
  onClose: () => void;
  onAddToCart: (item: CartPreviewItem) => void;
};

export function ProductModal({ open, product, onClose, onAddToCart }: ProductModalProps) {
  if (!product) {
    return null;
  }

  return (
    <Modal className="max-w-6xl" onClose={onClose} open={open} title={`Comprar ${product.name}`}>
      <div className="px-5 pb-7 pt-6 sm:px-8 sm:pt-8 lg:px-10 lg:py-12">
        <QuickBuyProductConfigurator
          onConfirm={onAddToCart}
          product={product}
          submitLabel="Agregar al carrito"
        />
      </div>
    </Modal>
  );
}
