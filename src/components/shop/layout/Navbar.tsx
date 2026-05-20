"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Menu, ShoppingCart, UserRound } from "lucide-react";
import { useState } from "react";
import { FavoriteAuthModal } from "@/components/shop/account/FavoriteAuthModal";
import { Button } from "@/components/ui/Button";
import { DesktopSearch } from "@/components/shop/layout/DesktopSearch";
import { MobileSearch } from "@/components/shop/layout/MobileSearch";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useUIStore } from "@/stores/ui-store";

export function Navbar() {
  const user = useAuthStore((state) => state.user);
  const openAccountDrawer = useUIStore((state) => state.openAccountDrawer);
  const openCart = useUIStore((state) => state.openCart);
  const openMobileMenu = useUIStore((state) => state.openMobileMenu);
  const [favoriteAuthModalOpen, setFavoriteAuthModalOpen] = useState(false);
  const itemCount = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0),
  );

  function handleFavoritesClick() {
    if (!user) {
      setFavoriteAuthModalOpen(true);
      return;
    }

    openAccountDrawer();
  }

  return (
    <>
      <header className="bg-accent text-white">
        <div className="relative mx-auto flex h-20 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          aria-label="Abrir menu"
          className="text-white hover:bg-white/10 lg:hidden"
          onClick={openMobileMenu}
          size="icon"
          variant="ghost"
        >
          <Menu aria-hidden size={22} />
        </Button>
        <Link className="flex shrink-0 items-center" href="/">
          <Image alt="EntrenAR" height={42} priority src="/logoWhite.svg" width={150} />
        </Link>
        <DesktopSearch />
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden lg:block">
            <Button
              className="text-white hover:bg-white/10"
              onClick={openAccountDrawer}
              size="sm"
              variant="ghost"
            >
              <UserRound aria-hidden size={18} />
              {user ? "Mi cuenta" : "Cuenta"}
            </Button>
          </div>
          <MobileSearch />
          <Button
            aria-label="Favoritos"
            className="text-white hover:bg-white/10"
            onClick={handleFavoritesClick}
            size="icon"
            variant="ghost"
          >
            <Heart aria-hidden className="fill-white text-white" size={20} />
          </Button>
          <Button
            aria-label="Abrir carrito"
            className="border-white/25 bg-white text-accent hover:border-white"
            onClick={openCart}
            size="icon"
            variant="secondary"
          >
            <span className="relative">
              <ShoppingCart aria-hidden size={20} />
              {itemCount > 0 ? (
                <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              ) : null}
            </span>
          </Button>
        </div>
        </div>
      </header>
      <FavoriteAuthModal
        onClose={() => setFavoriteAuthModalOpen(false)}
        open={favoriteAuthModalOpen}
      />
    </>
  );
}
