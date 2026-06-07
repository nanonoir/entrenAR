"use client";

import { useEffect } from "react";

type BodyScrollSnapshot = {
  overflow: string;
  position: string;
  routeKey: string;
  scrollY: number;
  top: string;
  width: string;
};

let activeLockCount = 0;
let bodyScrollSnapshot: BodyScrollSnapshot | null = null;

function lockBodyScroll() {
  if (activeLockCount === 0) {
    const scrollY = window.scrollY;

    bodyScrollSnapshot = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      routeKey: `${window.location.pathname}${window.location.search}`,
      scrollY,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
  }

  activeLockCount += 1;
}

function unlockBodyScroll() {
  activeLockCount = Math.max(0, activeLockCount - 1);

  if (activeLockCount > 0 || !bodyScrollSnapshot) {
    return;
  }

  const { overflow, position, routeKey, scrollY, top, width } = bodyScrollSnapshot;
  const currentRouteKey = `${window.location.pathname}${window.location.search}`;

  document.body.style.position = position;
  document.body.style.top = top;
  document.body.style.width = width;
  document.body.style.overflow = overflow;
  bodyScrollSnapshot = null;

  window.scrollTo({
    left: 0,
    top: currentRouteKey === routeKey ? scrollY : 0,
    behavior: "auto",
  });
}

export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return;
    }

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [locked]);
}
