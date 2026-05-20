"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { AccountEntryButton } from "@/components/shop/account/AccountEntryButton";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { accountEntryLabel } from "@/lib/data/account";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import type { AccountNavItem } from "@/types/account";
import type { ShopNavItem } from "@/types/navigation";

type MobileMenuProps = {
  navItems: ShopNavItem[];
  accountLinks: AccountNavItem[];
};

export function MobileMenu({ navItems, accountLinks }: MobileMenuProps) {
  const isOpen = useUIStore((state) => state.isMobileMenuOpen);
  const close = useUIStore((state) => state.closeMobileMenu);
  const openAccountDrawer = useUIStore((state) => state.openAccountDrawer);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  function toggleItem(label: string) {
    setOpenItem((current) => (current === label ? null : label));
    setOpenGroup(null);
  }

  function toggleGroup(title: string) {
    setOpenGroup((current) => (current === title ? null : title));
  }

  function handleAccountAction() {
    close();
    openAccountDrawer();
  }

  return (
    <Drawer onClose={close} open={isOpen} side="left" title="Menu">
      <div className="flex min-h-0 flex-1 flex-col">
        <nav className="grid flex-1 content-start gap-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const isOpenItem = openItem === item.label;

            if (!item.groups) {
              return (
                <Link
                  className={cn(
                    "rounded-button px-3 py-3 font-subtitle uppercase hover:bg-black/5",
                    item.highlight ? "font-bold text-sale" : "font-medium",
                  )}
                  href={item.href}
                  key={item.label}
                  onClick={close}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <div key={item.label}>
                <button
                  aria-expanded={isOpenItem}
                  className="flex w-full items-center justify-between rounded-button px-3 py-3 text-left font-subtitle font-medium uppercase hover:bg-black/5"
                  onClick={() => toggleItem(item.label)}
                  type="button"
                >
                  {item.label}
                  <ChevronDown
                    aria-hidden
                    className={cn("transition-transform", isOpenItem ? "rotate-180" : "")}
                    size={18}
                  />
                </button>
                <div
                  className={cn(
                    "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out",
                    isOpenItem ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="min-h-0 overflow-hidden pl-3">
                    {item.groups.map((group) => {
                      const isSupplements = item.label === "SUPLEMENTOS";
                      const isOpenGroup = openGroup === group.title;

                      if (!isSupplements) {
                        return (
                          <div className="grid gap-1 py-1" key={group.title}>
                            {group.links.map((link) => (
                              <Link
                                className="rounded-button px-3 py-2 text-sm text-text-muted hover:bg-black/5 hover:text-accent"
                                href={link.href}
                                key={link.label}
                                onClick={close}
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>
                        );
                      }

                      return (
                        <div key={group.title}>
                          <button
                            aria-expanded={isOpenGroup}
                            className="flex w-full items-center justify-between rounded-button px-3 py-2 text-left font-subtitle text-sm font-medium uppercase text-text-muted hover:bg-black/5 hover:text-text"
                            onClick={() => toggleGroup(group.title)}
                            type="button"
                          >
                            {group.title}
                            <ChevronDown
                              aria-hidden
                              className={cn("transition-transform", isOpenGroup ? "rotate-180" : "")}
                              size={16}
                            />
                          </button>
                          <div
                            className={cn(
                              "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out",
                              isOpenGroup ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                            )}
                          >
                            <div className="grid min-h-0 gap-1 overflow-hidden pl-3">
                              {group.links.map((link) => (
                                <Link
                                  className="rounded-button px-3 py-2 text-sm text-text-muted hover:bg-black/5 hover:text-accent"
                                  href={link.href}
                                  key={link.label}
                                  onClick={close}
                                >
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className="grid gap-2 border-t border-border p-4">
          {accountLinks.map((item) => (
            item.label === accountEntryLabel ? (
              <AccountEntryButton key={item.label} onClick={handleAccountAction} />
            ) : (
              <Button
                className="w-full"
                key={item.label}
                onClick={handleAccountAction}
                variant={item.variant}
              >
                {item.label}
              </Button>
            )
          ))}
        </div>
      </div>
    </Drawer>
  );
}
