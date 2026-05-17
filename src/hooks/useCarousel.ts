"use client";

import { useEffect, useRef, useState } from "react";

type UseCarouselOptions = {
  itemCount: number;
  autoplayMs?: number;
  swipeThreshold?: number;
};

export function useCarousel({
  itemCount,
  autoplayMs,
  swipeThreshold = 50,
}: UseCarouselOptions) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (itemCount <= 1 || !autoplayMs) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % itemCount);
    }, autoplayMs);

    return () => window.clearInterval(timer);
  }, [autoplayMs, itemCount, resetKey]);

  function restartAutoplay() {
    setResetKey((current) => current + 1);
  }

  function goToSlide(index: number) {
    if (itemCount === 0) {
      return;
    }

    setActiveIndex(index);
    restartAutoplay();
  }

  function goToPrevious() {
    if (itemCount === 0) {
      return;
    }

    setActiveIndex((current) => (current === 0 ? itemCount - 1 : current - 1));
    restartAutoplay();
  }

  function goToNext() {
    if (itemCount === 0) {
      return;
    }

    setActiveIndex((current) => (current + 1) % itemCount);
    restartAutoplay();
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    if (touchStartX.current === null) {
      return;
    }

    const touchEndX = event.changedTouches[0]?.clientX;
    const deltaX = typeof touchEndX === "number" ? touchEndX - touchStartX.current : 0;
    touchStartX.current = null;

    if (Math.abs(deltaX) < swipeThreshold) {
      return;
    }

    if (deltaX > 0) {
      goToPrevious();
      return;
    }

    goToNext();
  }

  return {
    activeIndex,
    goToSlide,
    goToPrevious,
    goToNext,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
    },
  };
}
