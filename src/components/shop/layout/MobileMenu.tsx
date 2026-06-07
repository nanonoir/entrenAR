"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, UserRound } from "lucide-react";
import type { MouseEvent } from "react";
import { useRef, useState } from "react";
import { AccountEntryButton } from "@/components/shop/account/AccountEntryButton";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";
import type { ShopNavItem } from "@/types/navigation";

type MobileMenuProps = {
  navItems: ShopNavItem[];
};

export function MobileMenu({ navItems }: MobileMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isOpen = useUIStore((state) => state.isMobileMenuOpen);
  const close = useUIStore((state) => state.closeMobileMenu);
  const openAccountDrawer = useUIStore((state) => state.openAccountDrawer);
  const pendingHref = useRef<string | null>(null);
  const [skipExitAnimation, setSkipExitAnimation] = useState(false);
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

  function getPathname(href: string) {
    return href.split("#")[0]?.split("?")[0] ?? href;
  }

  function handleLinkClick(href: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      event.preventDefault();
      pendingHref.current = href;
      setSkipExitAnimation(true);
      close();
    };
  }

  function handleExited() {
    const href = pendingHref.current;

    if (!href) {
      return;
    }

    pendingHref.current = null;
    setSkipExitAnimation(false);

    if (getPathname(href) === pathname) {
      window.scrollTo({ left: 0, top: 0, behavior: "auto" });
      return;
    }

    router.push(href);
  }

  return (
    <Drawer
      onClose={close}
      onExited={handleExited}
      open={isOpen}
      side="left"
      skipExitAnimation={skipExitAnimation}
      title="Menu"
    >
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
                  onClick={handleLinkClick(item.href)}
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
                                onClick={handleLinkClick(link.href)}
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
                                  onClick={handleLinkClick(link.href)}
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
          {user ? (
            <Button className="w-full" onClick={handleAccountAction}>
              <UserRound aria-hidden size={18} />
              Mi cuenta
            </Button>
          ) : (
            <AccountEntryButton onClick={handleAccountAction} />
          )}
        </div>
      </div>
    </Drawer>
  );
}
