"use client";

import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import { adminFooterActions, adminNavGroups } from "@/lib/data/admin/navigation";

export function AdminMobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="Menú admin" side="right" className="bg-white">
      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {adminNavGroups.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{group.label}</p>
            <div className="grid gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={onClose} className="flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950">
                    <Icon aria-hidden size={18} />
                    {item.label}
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
                <Link key={item.href} href={item.href} onClick={onClose} className="flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950">
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
