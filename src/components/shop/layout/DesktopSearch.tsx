"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useProductSearch } from "@/hooks/useProductSearch";

export function DesktopSearch() {
  const { handleSubmit, inputRef, query, setQuery } = useProductSearch();

  return (
    <form className="hidden flex-1 lg:block" onSubmit={handleSubmit}>
      <label className="relative block">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          size={18}
        />
        <Input
          aria-label="Buscar productos"
          className="border-white bg-white pl-10 text-text"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar proteína, creatina, marca..."
          ref={inputRef}
          value={query}
        />
      </label>
    </form>
  );
}
