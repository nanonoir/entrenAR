"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { adminFooterActions, adminNavGroups } from "@/lib/data/admin/navigation";
import type { AdminNavEntry } from "@/lib/data/admin/navigation";
import { isAdminAccordionActive, isAdminAccordionChildActive, isAdminPathActive } from "@/components/admin/layout/admin-nav-matching";
import { cn } from "@/lib/utils";

type AccordionEntryProps = {
  entry: Extract<AdminNavEntry, { type: "accordion" }>;
  pathname: string;
  collapsed: boolean;
};

function AccordionEntry({ entry, pathname, collapsed }: AccordionEntryProps) {
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

  // In collapsed mode, show only the parent icon as a direct link to primary route
  if (collapsed) {
    return (
      <Link
        href={entry.href}
        title={entry.label}
        className={cn(
          "flex h-11 items-center justify-center rounded-2xl px-0 text-sm font-semibold transition",
          anyChildActive ? "bg-accent-soft text-accent-hover" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
        )}
      >
        <Icon aria-hidden size={18} />
        <span className="sr-only">{entry.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <div
        className={cn(
          "flex h-11 items-center rounded-2xl text-sm font-semibold transition",
          anyChildActive ? "text-accent-hover" : "text-zinc-600",
        )}
      >
        <Link
          href={entry.href}
          className={cn(
            "flex flex-1 items-center gap-3 px-3 py-2 rounded-2xl transition",
            anyChildActive ? "bg-accent-soft text-accent-hover" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
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
            const childActive = isAdminAccordionChildActive(pathname, entry.href, child.href);
            const ChildIcon = child.icon;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-xl px-3 text-sm transition",
                  childActive
                    ? "bg-accent-soft font-semibold text-accent-hover"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
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

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-zinc-200 bg-white transition-[width] duration-200 md:sticky md:top-0 md:flex md:h-screen md:flex-col",
        collapsed ? "w-20" : "w-72",
      )}
    >
      <div className={cn("flex h-16 items-center justify-between border-b border-zinc-200 px-4", collapsed && "justify-center")}>
        {!collapsed ? <Image src="/blackLogo.svg" alt="EntrenAR CRM Admin" width={136} height={32} priority /> : null}
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <PanelLeftOpen aria-hidden size={18} /> : <PanelLeftClose aria-hidden size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {adminNavGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="grid gap-1">
              {group.entries.map((entry) => {
                if (entry.type === "accordion") {
                  return (
                    <AccordionEntry
                      key={entry.href}
                      entry={entry}
                      pathname={pathname}
                      collapsed={collapsed}
                    />
                  );
                }
                const Icon = entry.icon;
                const active = isAdminPathActive(pathname, entry.href);
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    title={collapsed ? entry.label : undefined}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition",
                      active ? "bg-accent-soft text-accent-hover" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Icon aria-hidden size={18} />
                    <span className={cn(collapsed && "sr-only")}>{entry.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-200 px-3 py-4">
        <div className="grid gap-1">
          {adminFooterActions.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon aria-hidden size={18} />
                <span className={cn(collapsed && "sr-only")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
