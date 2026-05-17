"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProductVisual } from "@/components/shop/products/ProductVisual";
import { useCarousel } from "@/hooks/useCarousel";
import { useImageZoom } from "@/hooks/useImageZoom";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/product";

type ProductImageGalleryProps = {
  images: ProductImage[];
  productName: string;
  brand: string;
  className?: string;
};

export function ProductImageGallery({
  images,
  productName,
  brand,
  className,
}: ProductImageGalleryProps) {
  const { activeIndex, goToSlide, goToPrevious, goToNext, touchHandlers } = useCarousel({
    itemCount: images.length,
  });
  const activeImage = images[activeIndex] ?? images[0];
  const { isZoomed, toggleZoom } = useImageZoom({ resetKey: activeImage?.id });

  if (!activeImage) {
    return null;
  }

  return (
    <div className={cn("grid gap-4 md:grid-cols-[72px_1fr] lg:grid-cols-[88px_1fr]", className)}>
      <div className="hidden flex-col gap-3 md:flex">
        {images.map((image, index) => {
          const selected = index === activeIndex;

          return (
            <button
              aria-label={`Ver imagen ${index + 1} de ${productName}`}
              aria-pressed={selected}
              className={cn(
                "overflow-hidden rounded-card border bg-white transition",
                selected ? "border-accent shadow-card" : "border-border hover:border-accent",
              )}
              key={image.id}
              onClick={() => goToSlide(index)}
              type="button"
            >
              <ProductVisual
                brand={brand}
                className="h-20 rounded-none p-1 lg:h-24"
                name={productName}
                tone={image.tone}
              />
            </button>
          );
        })}
      </div>

      <div className="min-w-0">
        <div className="relative h-[360px] w-full overflow-hidden rounded-card border border-border bg-white shadow-card sm:h-[460px] md:h-[560px] lg:h-[640px] lg:w-[696px]">
          <button
            aria-label={isZoomed ? "Alejar imagen" : "Ampliar imagen"}
            className={cn("block h-full w-full text-left", isZoomed ? "cursor-zoom-out" : "cursor-zoom-in")}
            onClick={toggleZoom}
            type="button"
            {...(!isZoomed ? touchHandlers : {})}
          >
            <div
              className="flex h-full transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {images.map((image) => (
                <ProductVisual
                  brand={brand}
                  className={cn(
                    "h-full min-w-full rounded-none bg-white transition duration-300",
                    isZoomed ? "scale-150" : "scale-100",
                  )}
                  key={image.id}
                  name={productName}
                  tone={image.tone}
                />
              ))}
            </div>
          </button>

          {images.length > 1 ? (
            <div className="absolute bottom-4 right-4 hidden gap-2 lg:flex">
              <Button
                aria-label="Imagen anterior"
                className="rounded-full border border-accent bg-white text-accent shadow-md hover:bg-accent hover:text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  goToPrevious();
                }}
                size="icon"
                variant="ghost"
              >
                <ChevronLeft aria-hidden size={22} />
              </Button>
              <Button
                aria-label="Imagen siguiente"
                className="rounded-full border border-accent bg-white text-accent shadow-md hover:bg-accent hover:text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  goToNext();
                }}
                size="icon"
                variant="ghost"
              >
                <ChevronRight aria-hidden size={22} />
              </Button>
            </div>
          ) : null}
        </div>

        {images.length > 1 ? (
          <div className="mt-4 flex justify-center gap-2 lg:hidden">
            {images.map((image, index) => (
              <button
                aria-label={`Ver imagen ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border border-accent transition",
                  index === activeIndex ? "bg-accent" : "bg-white",
                )}
                key={image.id}
                onClick={() => goToSlide(index)}
                type="button"
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
