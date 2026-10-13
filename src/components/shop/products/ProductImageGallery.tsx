"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
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
  activeImageId?: string;
  activeVariantId?: string;
};

export function ProductImageGallery({ images, productName, brand, className, activeImageId, activeVariantId }: ProductImageGalleryProps) {
  const { activeIndex, goToSlide, goToPrevious, goToNext, touchHandlers } = useCarousel({ itemCount: images.length });
  const activeImage = images[activeIndex] ?? images[0];
  const thumbnailRail = useRef<HTMLDivElement>(null);
  const thumbnailContent = useRef<HTMLDivElement>(null);
  const [railState, setRailState] = useState({ overflows: false, atStart: true, atEnd: true });
  const { isZoomed, toggleZoom, moveZoomOrigin, transformOrigin } = useImageZoom({ resetKey: `${activeImage?.id ?? ""}:${activeVariantId ?? ""}` });
  const syncVariantImage = useEffectEvent(() => {
    const index = images.findIndex((image) => image.id === activeImageId);
    if (index >= 0 && index !== activeIndex) goToSlide(index);
  });

  useEffect(() => {
    if (activeImageId) syncVariantImage();
  }, [activeImageId, images]);

  useEffect(() => {
    const rail = thumbnailRail.current;
    const content = thumbnailContent.current;
    if (!rail || !content) return;
    function updateBounds() {
      if (!rail) return;
      const maxScroll = Math.max(0, rail.scrollHeight - rail.clientHeight);
      const next = { overflows: rail.clientHeight > 0 && maxScroll > 1, atStart: rail.scrollTop <= 1, atEnd: rail.scrollTop >= maxScroll - 1 };
      setRailState((previous) => previous.overflows === next.overflows && previous.atStart === next.atStart && previous.atEnd === next.atEnd ? previous : next);
    }
    const observer = new ResizeObserver(updateBounds);
    observer.observe(rail);
    observer.observe(content);
    rail.addEventListener("scroll", updateBounds, { passive: true });
    updateBounds();
    return () => { observer.disconnect(); rail.removeEventListener("scroll", updateBounds); };
  }, [images.length]);

  useEffect(() => {
    const rail = thumbnailRail.current;
    const selected = thumbnailContent.current?.querySelector<HTMLButtonElement>(`[data-image-index="${activeIndex}"]`);
    if (!rail || !selected || rail.clientHeight === 0) return;
    const railBounds = rail.getBoundingClientRect();
    const selectedBounds = selected.getBoundingClientRect();
    // Scroll only this rail, never the document or other ancestors.
    if (selectedBounds.top < railBounds.top) rail.scrollTop -= railBounds.top - selectedBounds.top;
    else if (selectedBounds.bottom > railBounds.bottom) rail.scrollTop += selectedBounds.bottom - railBounds.bottom;
  }, [activeIndex, images, railState.overflows]);

  function scrollThumbnails(direction: number) {
    const rail = thumbnailRail.current;
    if (!rail) return;
    rail.scrollBy({ top: direction * rail.clientHeight * 0.8, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  if (!activeImage) return null;

  return (
    <div className={cn("grid min-w-0 gap-4 [--gallery-height:360px] sm:[--gallery-height:460px] md:[--gallery-height:560px] lg:grid-cols-[88px_minmax(0,1fr)] lg:[--gallery-height:640px]", className)}>
      <div aria-label="Miniaturas del producto" className="hidden h-[var(--gallery-height)] min-h-0 flex-col gap-2 lg:flex">
        {railState.overflows ? <Button aria-label="Miniaturas anteriores" className="h-8 w-full shrink-0" disabled={railState.atStart} onClick={() => scrollThumbnails(-1)} size="sm" variant="ghost"><ChevronUp aria-hidden size={20} /></Button> : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" ref={thumbnailRail}>
          <div className="flex flex-col gap-3" ref={thumbnailContent}>
            {images.map((image, index) => (
              <button
                aria-label={`Ver imagen ${index + 1} de ${productName}`}
                aria-pressed={index === activeIndex}
                className={cn("h-24 w-full shrink-0 overflow-hidden rounded-card border bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent", index === activeIndex ? "border-accent shadow-card" : "border-border hover:border-accent")}
                data-image-index={index}
                key={image.id}
                onClick={() => goToSlide(index)}
                type="button"
              >
                {image.url ? <img alt={image.alt || productName} className="h-full w-full object-contain p-1" src={image.url} /> : <ProductVisual brand={brand} className="h-full rounded-none p-1" name={productName} tone={image.tone} />}
              </button>
            ))}
          </div>
        </div>
        {railState.overflows ? <Button aria-label="Miniaturas siguientes" className="h-8 w-full shrink-0" disabled={railState.atEnd} onClick={() => scrollThumbnails(1)} size="sm" variant="ghost"><ChevronDown aria-hidden size={20} /></Button> : null}
      </div>

      <div className="min-w-0">
        <div className="relative h-[var(--gallery-height)] w-full overflow-hidden rounded-card border border-border bg-white shadow-card">
          <button
            aria-label={isZoomed ? "Alejar imagen" : "Ampliar imagen"}
            className={cn("block h-full w-full overflow-hidden text-left", isZoomed ? "cursor-zoom-out" : "cursor-zoom-in")}
            onClick={toggleZoom}
            onPointerMove={(event) => { if (event.pointerType === "mouse" && window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches) moveZoomOrigin(event); }}
            type="button"
            {...(!isZoomed ? touchHandlers : {})}
          >
            <div className="flex h-full w-full transition-transform duration-200 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
              {images.map((image, index) => (
                <div aria-hidden={index !== activeIndex} className="h-full w-full shrink-0 overflow-hidden" key={image.id}>
                  <div className="h-full w-full transition-transform duration-200 ease-out motion-reduce:transition-none" style={{ transform: isZoomed && index === activeIndex ? "scale(1.5)" : "scale(1)", transformOrigin: index === activeIndex ? transformOrigin : "50% 50%" }}>
                    {image.url ? <img alt={image.alt || productName} className="h-full w-full object-contain" src={image.url} draggable={false} /> : <ProductVisual brand={brand} className="h-full w-full rounded-none bg-white" name={productName} tone={image.tone} />}
                  </div>
                </div>
              ))}
            </div>
          </button>
          {images.length > 1 ? <div className="absolute bottom-4 right-4 hidden gap-2 lg:flex">
            <Button aria-label="Imagen anterior" className="rounded-full border border-accent bg-white text-accent shadow-md hover:bg-accent hover:text-white" onClick={goToPrevious} size="icon" variant="ghost"><ChevronLeft aria-hidden size={22} /></Button>
            <Button aria-label="Imagen siguiente" className="rounded-full border border-accent bg-white text-accent shadow-md hover:bg-accent hover:text-white" onClick={goToNext} size="icon" variant="ghost"><ChevronRight aria-hidden size={22} /></Button>
          </div> : null}
        </div>
        {images.length > 1 ? <div className="mt-4 flex justify-center gap-2 lg:hidden">
          {images.map((image, index) => <button aria-label={`Ver imagen ${index + 1}`} aria-current={index === activeIndex ? "true" : undefined} className={cn("h-2.5 w-2.5 rounded-full border border-accent transition-colors", index === activeIndex ? "bg-accent" : "bg-white")} key={image.id} onClick={() => goToSlide(index)} type="button" />)}
        </div> : null}
      </div>
    </div>
  );
}
