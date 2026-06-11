"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AdminMobileDrawer } from "@/components/admin/layout/MobileDrawer";
import { mobilePrimaryNav } from "@/lib/data/admin/navigation";
import { cn } from "@/lib/utils";

export function AdminMobileNav() {
  const pathname = usePathname();
  const [drawerState, setDrawerState] = useState({ open: false, openedAtPath: pathname });
  const drawerOpen = drawerState.open && drawerState.openedAtPath === pathname;

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-zinc-200 bg-white md:hidden">
        {mobilePrimaryNav.map((item) => {
          const Icon = item.icon;
          const isMenu = item.href === "#menu";
          const active = isMenu
            ? drawerOpen
            : item.href === "/admin"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const className = cn("flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition", active ? "text-accent-hover" : "text-zinc-500");

          return isMenu ? (
            <button key={item.label} type="button" className={className} onClick={() => setDrawerState({ open: true, openedAtPath: pathname })} aria-label="Abrir menú admin">
              <Icon aria-hidden size={20} />
              {item.label}
            </button>
          ) : (
            <Link key={item.label} href={item.href} className={className}>
              <Icon aria-hidden size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <AdminMobileDrawer open={drawerOpen} onClose={() => setDrawerState((state) => ({ ...state, open: false }))} />
    </>
  );
}
