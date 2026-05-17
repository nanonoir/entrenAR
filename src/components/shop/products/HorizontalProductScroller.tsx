"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type HorizontalProductScrollerProps = {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  contentClassName?: string;
};

const SCROLL_DISTANCE = 360;
const SCROLL_DURATION_MS = 800;

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

export function HorizontalProductScroller({
  children,
  ariaLabel,
  className,
  contentClassName,
}: HorizontalProductScrollerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [activePage, setActivePage] = useState(0);

  function animateTo(targetLeft: number) {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    const scrollElement = scrollerRef.current;

    if (!scrollElement) {
      return;
    }

    const targetElement = scrollElement;
    const startLeft = targetElement.scrollLeft;
    const distance = targetLeft - startLeft;
    const startTime = window.performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / SCROLL_DURATION_MS);
      const easedProgress = easeInOutCubic(progress);

      targetElement.scrollLeft = startLeft + distance * easedProgress;

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(animate);
        return;
      }

      animationFrameRef.current = null;
    }

    animationFrameRef.current = window.requestAnimationFrame(animate);
  }

  const updatePagination = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const maxLeft = scroller.scrollWidth - scroller.clientWidth;
    const nextPageCount = Math.max(1, Math.ceil(scroller.scrollWidth / scroller.clientWidth));
    const nextActivePage =
      maxLeft <= 0 ? 0 : Math.round((scroller.scrollLeft / maxLeft) * (nextPageCount - 1));

    setPageCount(nextPageCount);
    setActivePage(Math.min(nextPageCount - 1, nextActivePage));
  }, []);

  function scroll(direction: "left" | "right") {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const maxLeft = scroller.scrollWidth - scroller.clientWidth;
    const targetLeft = Math.max(
      0,
      Math.min(maxLeft, scroller.scrollLeft + (direction === "left" ? -SCROLL_DISTANCE : SCROLL_DISTANCE)),
    );

    animateTo(targetLeft);
  }

  function scrollToPage(pageIndex: number) {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    const maxLeft = scroller.scrollWidth - scroller.clientWidth;
    const targetLeft = pageCount <= 1 ? 0 : (maxLeft / (pageCount - 1)) * pageIndex;

    animateTo(targetLeft);
  }

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return undefined;
    }

    updatePagination();

    scroller.addEventListener("scroll", updatePagination, { passive: true });
    window.addEventListener("resize", updatePagination);

    return () => {
      scroller.removeEventListener("scroll", updatePagination);
      window.removeEventListener("resize", updatePagination);

      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [children, updatePagination]);

  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
        <Button
          aria-label={`Ver anteriores: ${ariaLabel}`}
          className="rounded-full border-accent bg-white text-accent shadow-md transition hover:scale-105 hover:bg-accent-soft active:scale-95"
          onClick={() => scroll("left")}
          size="icon"
          variant="secondary"
        >
          <ChevronLeft aria-hidden size={20} />
        </Button>
      </div>
      <div
        aria-label={ariaLabel}
        className={cn(
          "flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] lg:px-14 [&::-webkit-scrollbar]:hidden",
          contentClassName,
        )}
        ref={scrollerRef}
        role="list"
      >
        {children}
      </div>
      {pageCount > 1 ? (
        <div className="mt-4 flex justify-center gap-2 lg:hidden">
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              aria-label={`Ir al grupo ${index + 1} de ${ariaLabel}`}
              aria-current={activePage === index ? "true" : undefined}
              className={cn(
                "h-2.5 w-2.5 rounded-full border border-accent transition",
                activePage === index ? "bg-accent" : "bg-white",
              )}
              key={index}
              onClick={() => scrollToPage(index)}
              type="button"
            />
          ))}
        </div>
      ) : null}
      <div className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
        <Button
          aria-label={`Ver mas: ${ariaLabel}`}
          className="rounded-full border-accent bg-white text-accent shadow-md transition hover:scale-105 hover:bg-accent-soft active:scale-95"
          onClick={() => scroll("right")}
          size="icon"
          variant="secondary"
        >
          <ChevronRight aria-hidden size={20} />
        </Button>
      </div>
    </div>
  );
}
