"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { adminFooterActions, adminNavGroups } from "@/lib/data/admin/navigation";
import type { AdminNavEntry } from "@/lib/data/admin/navigation";
import { isAdminAccordionActive, isAdminPathActive } from "@/components/admin/layout/admin-nav-matching";
import { cn } from "@/lib/utils";

type MobileAccordionEntryProps = {
  entry: Extract<AdminNavEntry, { type: "accordion" }>;
  pathname: string;
  onNavigate: () => void;
};

function MobileAccordionEntry({ entry, pathname, onNavigate }: MobileAccordionEntryProps) {
  const anyChildActive = isAdminAccordionActive(pathname, entry.href, entry.children);
  const [open, setOpen] = useState(anyChildActive);
  const visibleOpen = open || anyChildActive;
  const Icon = entry.icon;

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen((prev) => !prev);
    },
    [],
  );

  return (
    <div>
      <div className="flex h-11 items-center rounded-2xl text-sm font-semibold">
        <Link
          href={entry.href}
          onClick={onNavigate}
          className={cn(
            "flex flex-1 items-center gap-3 px-3 py-2 rounded-2xl transition",
            anyChildActive ? "bg-accent-soft text-accent-hover" : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
          )}
        >
          <Icon aria-hidden size={18} />
          <span>{entry.label}</span>
        </Link>
        <button
          type="button"
          aria-label={visibleOpen ? `Colapsar ${entry.label}` : `Expandir ${entry.label}`}
          aria-expanded={visibleOpen}
          onClick={handleChevronClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition hover:bg-zinc-100"
        >
          <ChevronDown
            aria-hidden
            size={16}
            className={cn("transition-transform duration-200", visibleOpen && "rotate-180")}
          />
        </button>
      </div>

      {visibleOpen && (
        <div className="mt-1 ml-7 grid gap-0.5 border-l border-zinc-200 pl-3">
          {entry.children.map((child) => {
            const childActive = isAdminPathActive(pathname, child.href);
            const ChildIcon = child.icon;
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-xl px-3 text-sm transition",
                  childActive
                    ? "bg-accent-soft font-semibold text-accent-hover"
                    : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
                )}
              >
                {ChildIcon ? <ChildIcon aria-hidden size={14} /> : null}
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminMobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <Drawer open={open} onClose={onClose} title="Menú admin" side="right" className="bg-white">
      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {adminNavGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="grid gap-1">
              {group.entries.map((entry) => {
                if (entry.type === "accordion") {
                  return (
                    <MobileAccordionEntry
                      key={entry.href}
                      entry={entry}
                      pathname={pathname}
                      onNavigate={onClose}
                    />
                  );
                }
                const Icon = entry.icon;
                const active = isAdminPathActive(pathname, entry.href);
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    onClick={onClose}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition",
                      active ? "bg-accent-soft text-accent-hover" : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
                    )}
                  >
                    <Icon aria-hidden size={18} />
                    {entry.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        <div className="border-t border-zinc-200 pt-4">
          <div className="grid gap-1">
            {adminFooterActions.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                >
                  <Icon aria-hidden size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </Drawer>
  );
}
