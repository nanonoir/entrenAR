"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function ShopRouteScrollTop() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ left: 0, top: 0, behavior: "auto" });
    });
  }, [pathname]);

  return null;
}
