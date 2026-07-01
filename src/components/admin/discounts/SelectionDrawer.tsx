"use client";

import { ArrowLeft, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer } from "@/components/ui/Drawer";
import type { DiscountSelectOption } from "@/lib/data/admin/discounts/types";
import { normalizeSearch } from "@/components/admin/discounts/discount-utils";

type SelectionDrawerProps = {
  description: string;
  options: DiscountSelectOption[];
  open: boolean;
  searchable?: boolean;
  selectedIds: string[];
  title: string;
  onClose: () => void;
  onSelectedIdsChange: (ids: string[]) => void;
};

export function SelectionDrawer({ description, options, open, searchable = true, selectedIds, title, onClose, onSelectedIdsChange }: SelectionDrawerProps) {
  const [search, setSearch] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredOptions = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return options;
    return options.filter((option) => [option.label, option.description ?? ""].some((value) => normalizeSearch(value).includes(query)));
  }, [options, search]);

  function toggle(id: string) {
    if (selected.has(id)) onSelectedIdsChange(selectedIds.filter((selectedId) => selectedId !== id));
    else onSelectedIdsChange([...selectedIds, id]);
  }

  return (
    <Drawer
      open={open}
      title={title}
      className="max-w-lg"
      onClose={onClose}
      headerContent={
        <div className="flex min-w-0 items-center gap-2">
          <Button aria-label="Volver" size="icon" variant="ghost" onClick={onClose}><ArrowLeft aria-hidden size={20} /></Button>
          <h2 className="truncate text-lg font-semibold text-text">{title}</h2>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-border p-4">
          <p className="text-sm leading-6 text-text-muted">{description}</p>
          {searchable ? (
            <div className="relative mt-4">
              <input
                aria-label={`Buscar ${title.toLowerCase()}`}
                className="h-11 w-full rounded-button border border-border bg-surface px-3 pr-10 text-base outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm"
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Buscar"
                type="search"
                value={search}
              />
              <Search aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            </div>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-2">
            {filteredOptions.length === 0 ? <p className="rounded-2xl bg-surface p-4 text-sm text-text-muted">No encontramos opciones.</p> : null}
            {filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-white p-3 text-left transition hover:border-accent hover:bg-accent-soft/40"
                onClick={() => toggle(option.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text">{option.label}</span>
                  {option.description ? <span className="block truncate text-xs text-text-muted">{option.description}</span> : null}
                </span>
                <Checkbox checked={selected.has(option.id)} readOnly aria-label={`Seleccionar ${option.label}`} label={<span className="sr-only">Seleccionar {option.label}</span>} />
              </button>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t border-border p-4 text-xs text-text-muted">{selectedIds.length} seleccionados. La selección se conserva al volver.</div>
      </div>
    </Drawer>
  );
}
