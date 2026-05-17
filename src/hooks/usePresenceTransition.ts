"use client";

import { useEffect, useState } from "react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

type UsePresenceTransitionOptions = {
  durationMs: number;
  open: boolean;
};

export function usePresenceTransition({ durationMs, open }: UsePresenceTransitionOptions) {
  const [shouldRender, setShouldRender] = useState(open);
  const [isVisible, setIsVisible] = useState(false);

  useLockBodyScroll(shouldRender);

  useEffect(() => {
    let showFrame = 0;
    let visibleFrame = 0;
    let hideFrame = 0;
    let timeout = 0;

    if (open) {
      showFrame = window.requestAnimationFrame(() => {
        setShouldRender(true);
        visibleFrame = window.requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });

      return () => {
        window.cancelAnimationFrame(showFrame);
        window.cancelAnimationFrame(visibleFrame);
      };
    }

    hideFrame = window.requestAnimationFrame(() => {
      setIsVisible(false);
    });
    timeout = window.setTimeout(() => {
      setShouldRender(false);
    }, durationMs);

    return () => {
      window.cancelAnimationFrame(hideFrame);
      window.clearTimeout(timeout);
    };
  }, [durationMs, open]);

  return {
    isVisible,
    shouldRender,
  };
}
