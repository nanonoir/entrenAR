"use client";

import { Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useProductSearch } from "@/hooks/useProductSearch";
import { cn } from "@/lib/utils";

export function MobileSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const { handleSubmit, inputRef, query, setQuery } = useProductSearch({
    autoFocusWhen: isOpen,
    onSubmitSuccess: () => setIsOpen(false),
  });

  function toggleSearch() {
    setIsOpen((current) => !current);
  }

  return (
    <div className="lg:hidden">
      <Button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Cerrar b\u00fasqueda" : "Abrir b\u00fasqueda"}
        className="text-white hover:bg-white/10"
        onClick={toggleSearch}
        size="icon"
        variant="ghost"
      >
        {isOpen ? <X aria-hidden size={20} /> : <Search aria-hidden size={20} />}
      </Button>
      <div
        className={cn(
          "absolute left-0 right-0 top-20 grid overflow-hidden bg-accent px-4 shadow-sm transition-[grid-template-rows,opacity] duration-200 ease-out sm:px-6 lg:hidden",
          isOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <form className="min-h-0 overflow-hidden pb-4" onSubmit={handleSubmit}>
          <label className="relative block">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              size={18}
            />
            <Input
              aria-label="Buscar productos"
              className="border-white bg-white pl-10 pr-3 text-text"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar productos..."
              ref={inputRef}
              value={query}
            />
          </label>
        </form>
      </div>
    </div>
  );
}
