"use client";

import { Modal } from "@/components/ui/Modal";
import { QuickBuyProductConfigurator } from "@/components/shop/quick-buy/QuickBuyProductConfigurator";
import type { CartPreviewItem } from "@/types/cart";
import type { QuickBuyProduct } from "@/types/product";

type OfferProductSubModalProps = {
  open: boolean;
  product: QuickBuyProduct | null;
  onClose: () => void;
  onConfirm: (item: CartPreviewItem) => void;
};

export function OfferProductSubModal({
  open,
  product,
  onClose,
  onConfirm,
}: OfferProductSubModalProps) {
  if (!product) {
    return null;
  }

  return (
    <Modal className="max-w-4xl" onClose={onClose} open={open} title={`Agregar ${product.name}`}>
      <div className="px-5 pb-7 pt-6 sm:px-8 sm:pt-8 lg:px-10 lg:py-10">
        <QuickBuyProductConfigurator
          imageClassName="sm:min-h-[360px]"
          key={product.id}
          onConfirm={onConfirm}
          product={product}
          submitLabel="Agregar al carrito"
        />
      </div>
    </Modal>
  );
}
