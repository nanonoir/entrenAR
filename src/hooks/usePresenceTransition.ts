"use client";

import { useEffect, useRef, useState } from "react";

type UsePresenceTransitionOptions = {
  durationMs: number;
  onExited?: () => void;
  open: boolean;
  skipExitAnimation?: boolean;
};

export function usePresenceTransition({ durationMs, onExited, open, skipExitAnimation = false }: UsePresenceTransitionOptions) {
  const [shouldRender, setShouldRender] = useState(open);
  const [isVisible, setIsVisible] = useState(false);
  const hasOpenedRef = useRef(open);
  const onExitedRef = useRef(onExited);
  const shouldNotifyExitedRef = useRef(false);

  useEffect(() => {
    onExitedRef.current = onExited;
  }, [onExited]);

  useEffect(() => {
    if (!shouldNotifyExitedRef.current || shouldRender) {
      return;
    }

    shouldNotifyExitedRef.current = false;
    onExitedRef.current?.();
  }, [shouldRender]);

  useEffect(() => {
    let showFrame = 0;
    let visibleFrame = 0;
    let hideFrame = 0;
    let timeout = 0;

    if (open) {
      hasOpenedRef.current = true;
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

    if (!hasOpenedRef.current) {
      return;
    }

    if (skipExitAnimation) {
      hideFrame = window.requestAnimationFrame(() => {
        setIsVisible(false);
        setShouldRender(false);
        hasOpenedRef.current = false;
        shouldNotifyExitedRef.current = true;
      });
      return;
    }

    hideFrame = window.requestAnimationFrame(() => {
      setIsVisible(false);
    });
    timeout = window.setTimeout(() => {
      setShouldRender(false);
      hasOpenedRef.current = false;
      shouldNotifyExitedRef.current = true;
    }, durationMs);

    return () => {
      window.cancelAnimationFrame(hideFrame);
      window.clearTimeout(timeout);
    };
  }, [durationMs, open, skipExitAnimation]);

  return {
    isVisible,
    shouldRender,
  };
}
