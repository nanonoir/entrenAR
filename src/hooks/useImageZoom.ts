"use client";

import { useEffect, useState } from "react";

type UseImageZoomOptions = {
  resetKey?: string | number;
};

export function useImageZoom({ resetKey }: UseImageZoomOptions = {}) {
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setIsZoomed(false);
  }, [resetKey]);

  function toggleZoom() {
    setIsZoomed((current) => !current);
  }

  function resetZoom() {
    setIsZoomed(false);
  }

  return {
    isZoomed,
    resetZoom,
    toggleZoom,
  };
}
