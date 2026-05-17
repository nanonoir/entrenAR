"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCarousel } from "@/hooks/useCarousel";
import { cn } from "@/lib/utils";
import type { HeroBanner } from "@/types/home";

type HeroCarouselProps = {
  banners: HeroBanner[];
};

const AUTOPLAY_MS = 10000;

export function HeroCarousel({ banners }: HeroCarouselProps) {
  const mobileBanners = banners.filter((banner) => banner.mobileImageSrc);

  if (banners.length === 0) {
    return null;
  }

  return (
    <>
      {mobileBanners.length > 0 ? (
        <CarouselTrack banners={mobileBanners} mode="mobile" />
      ) : null}
      <CarouselTrack banners={banners} mode="desktop" />
    </>
  );
}

type CarouselTrackProps = {
  banners: HeroBanner[];
  mode: "desktop" | "mobile";
};

function CarouselTrack({ banners, mode }: CarouselTrackProps) {
  const { activeIndex, goToSlide, goToPrevious, goToNext, touchHandlers } = useCarousel({
    itemCount: banners.length,
    autoplayMs: AUTOPLAY_MS,
  });
  const isMobile = mode === "mobile";

  return (
    <section
      className={cn(
        "relative w-full overflow-hidden bg-zinc-950",
        isMobile ? "lg:hidden" : "hidden lg:block",
      )}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        {...touchHandlers}
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {banners.map((banner, index) => (
          <Link
            aria-label={banner.alt}
            className={cn(
              "group relative block min-w-full overflow-hidden bg-zinc-900",
              isMobile ? "h-[320px] sm:h-[360px]" : "h-[430px] 2xl:h-[500px]",
            )}
            href={banner.href}
            key={banner.id}
            tabIndex={activeIndex === index ? 0 : -1}
          >
            <Image
              alt={banner.alt}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
              fill
              priority={index === 0}
              sizes="100vw"
              src={isMobile ? banner.mobileImageSrc ?? banner.imageSrc : banner.imageSrc}
            />
          </Link>
        ))}
      </div>
      {banners.length > 1 && !isMobile ? (
        <>
          <div className="hidden lg:block">
            <Button
              aria-label="Banner anterior"
              className="absolute left-4 top-1/2 h-9 w-9 -translate-y-1/2 border border-white bg-transparent p-0 text-white hover:bg-white/10 xl:h-11 xl:w-11"
              onClick={goToPrevious}
              size="icon"
              variant="ghost"
            >
              <ChevronLeft aria-hidden size={22} />
            </Button>
            <Button
              aria-label="Banner siguiente"
              className="absolute right-4 top-1/2 h-9 w-9 -translate-y-1/2 border border-white bg-transparent p-0 text-white hover:bg-white/10 xl:h-11 xl:w-11"
              onClick={goToNext}
              size="icon"
              variant="ghost"
            >
              <ChevronRight aria-hidden size={22} />
            </Button>
          </div>
        </>
      ) : null}
      {banners.length > 1 ? (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 lg:bottom-5">
          {banners.map((banner, index) => (
            <button
              aria-label={`Ver banner ${index + 1}`}
              aria-current={activeIndex === index}
              className={cn(
                "h-2.5 rounded-full transition-all",
                activeIndex === index ? "w-8 bg-white" : "w-2.5 bg-white/55 hover:bg-white",
              )}
              key={banner.id}
              onClick={() => goToSlide(index)}
              type="button"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
