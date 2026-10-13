"use client";

import { useState, type PointerEvent } from "react";

type UseImageZoomOptions = {
  resetKey?: string | number;
};

export function useImageZoom({ resetKey }: UseImageZoomOptions = {}) {
  const [zoomState, setZoomState] = useState({
    isZoomed: false,
    resetKey,
    originX: 50,
    originY: 50,
  });
  const isZoomed = zoomState.resetKey === resetKey ? zoomState.isZoomed : false;

  function toggleZoom() {
    setZoomState((current) => {
      const isZoomed = current.resetKey === resetKey ? !current.isZoomed : true;
      return {
        isZoomed,
        resetKey,
        // Keep the anchor while shrinking back, so zoom-out does not jump to the center.
        originX: isZoomed ? 50 : current.originX,
        originY: isZoomed ? 50 : current.originY,
      };
    });
  }

  function resetZoom() {
    setZoomState({
      isZoomed: false,
      resetKey,
      originX: 50,
      originY: 50,
    });
  }

  function moveZoomOrigin(event: PointerEvent<HTMLElement>) {
    if (!isZoomed) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const originX = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
    const originY = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
    setZoomState({ isZoomed: true, resetKey, originX, originY });
  }

  return {
    isZoomed,
    resetZoom,
    toggleZoom,
    moveZoomOrigin,
    transformOrigin: zoomState.resetKey === resetKey ? `${zoomState.originX}% ${zoomState.originY}%` : "50% 50%",
  };
}
