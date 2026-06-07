import { CartDrawer } from "@/components/shop/cart/CartDrawer";
import { AccountDrawer } from "@/components/shop/account/AccountDrawer";
import { CategoriesBar } from "@/components/shop/layout/CategoriesBar";
import { Footer } from "@/components/shop/layout/Footer";
import { MobileMenu } from "@/components/shop/layout/MobileMenu";
import { Navbar } from "@/components/shop/layout/Navbar";
import { ShopRouteScrollTop } from "@/components/shop/layout/ShopRouteScrollTop";
import { TopPromoBar } from "@/components/shop/layout/TopPromoBar";
import { getPromoMessages } from "@/lib/data/promotions";
import { getShopNavItems } from "@/lib/data/navigation";

export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const navItems = getShopNavItems();
  const promoMessages = getPromoMessages();

  return (
    <>
      <ShopRouteScrollTop />
      <TopPromoBar messages={promoMessages} />
      <div className="sticky top-0 z-40 shadow-sm">
        <Navbar />
        <CategoriesBar navItems={navItems} />
      </div>
      <MobileMenu navItems={navItems} />
      <main className="flex-1">{children}</main>
      <Footer />
      <AccountDrawer />
      <CartDrawer />
    </>
  );
}
