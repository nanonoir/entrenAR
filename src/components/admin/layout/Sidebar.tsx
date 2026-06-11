"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { adminFooterActions, adminNavGroups } from "@/lib/data/admin/navigation";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn("hidden shrink-0 border-r border-zinc-200 bg-white transition-[width] duration-200 md:sticky md:top-0 md:flex md:h-screen md:flex-col", collapsed ? "w-20" : "w-72")}>
      <div className={cn("flex h-16 items-center justify-between border-b border-zinc-200 px-4", collapsed && "justify-center")}>
        {!collapsed ? <Image src="/blackLogo.svg" alt="EntrenAR CRM Admin" width={136} height={32} priority /> : null}
        <button className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}>
          {collapsed ? <PanelLeftOpen aria-hidden size={18} /> : <PanelLeftClose aria-hidden size={18} />}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {adminNavGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className={cn("mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400", collapsed && "sr-only")}>{group.label}</p>
            <div className="grid gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} className={cn("flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition", active ? "bg-accent-soft text-accent-hover" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950", collapsed && "justify-center px-0")}>
                    <Icon aria-hidden size={18} />
                    <span className={cn(collapsed && "sr-only")}>{item.label}</span>
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
              <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} className={cn("flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950", collapsed && "justify-center px-0")}>
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
