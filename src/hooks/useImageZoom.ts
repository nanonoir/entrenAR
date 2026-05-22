"use client";

import { useState } from "react";

type UseImageZoomOptions = {
  resetKey?: string | number;
};

export function useImageZoom({ resetKey }: UseImageZoomOptions = {}) {
  const [zoomState, setZoomState] = useState({
    isZoomed: false,
    resetKey,
  });
  const isZoomed = zoomState.resetKey === resetKey ? zoomState.isZoomed : false;

  function toggleZoom() {
    setZoomState((current) => ({
      isZoomed: current.resetKey === resetKey ? !current.isZoomed : true,
      resetKey,
    }));
  }

  function resetZoom() {
    setZoomState({
      isZoomed: false,
      resetKey,
    });
  }

  return {
    isZoomed,
    resetZoom,
    toggleZoom,
  };
}
