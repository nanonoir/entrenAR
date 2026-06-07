"use client";

import { ChevronDown } from "lucide-react";
import { MegaMenu } from "@/components/shop/layout/MegaMenu";
import { SameRouteScrollLink } from "@/components/shop/layout/SameRouteScrollLink";
import { useUIStore } from "@/stores/ui-store";
import type { ShopNavItem } from "@/types/navigation";

type CategoriesBarProps = {
  navItems: ShopNavItem[];
};

export function CategoriesBar({ navItems }: CategoriesBarProps) {
  const activeMegaMenu = useUIStore((state) => state.activeMegaMenu);
  const setActiveMegaMenu = useUIStore((state) => state.setActiveMegaMenu);
  const activeItem = navItems.find((item) => item.label === activeMegaMenu);

  return (
    <nav
      aria-label="Categorias principales"
      className="relative hidden border-b border-border bg-surface lg:block"
      onMouseLeave={() => setActiveMegaMenu(null)}
    >
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-center gap-9 px-8">
        {navItems.map((item) => (
          <SameRouteScrollLink
            className={`inline-flex h-full items-center gap-1 font-subtitle text-sm tracking-normal hover:text-accent ${
              item.highlight ? "font-bold text-sale" : "font-medium"
            }`}
            href={item.href}
            key={item.label}
            onFocus={() => setActiveMegaMenu(item.groups ? item.label : null)}
            onMouseEnter={() => setActiveMegaMenu(item.groups ? item.label : null)}
          >
            {item.label}
            {item.groups ? <ChevronDown aria-hidden size={14} /> : null}
          </SameRouteScrollLink>
        ))}
      </div>
      {activeItem?.groups ? <MegaMenu item={activeItem} /> : null}
    </nav>
  );
}
