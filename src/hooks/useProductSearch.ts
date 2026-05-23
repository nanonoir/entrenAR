"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type UseProductSearchOptions = {
  autoFocusWhen?: boolean;
  onSubmitSuccess?: () => void;
};

export function useProductSearch({
  autoFocusWhen = false,
  onSubmitSuccess,
}: UseProductSearchOptions = {}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!autoFocusWhen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [autoFocusWhen]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    router.push(`/buscar?q=${encodeURIComponent(trimmedQuery)}`);
    onSubmitSuccess?.();
  }

  return {
    handleSubmit,
    inputRef,
    query,
    setQuery,
  };
}
