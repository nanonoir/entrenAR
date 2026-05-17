import { CartDrawer } from "@/components/shop/cart/CartDrawer";
import { CategoriesBar } from "@/components/shop/layout/CategoriesBar";
import { Footer } from "@/components/shop/layout/Footer";
import { MobileMenu } from "@/components/shop/layout/MobileMenu";
import { Navbar } from "@/components/shop/layout/Navbar";
import { TopPromoBar } from "@/components/shop/layout/TopPromoBar";
import { getMobileAccountLinks } from "@/lib/data/account";
import { getPromoMessages } from "@/lib/data/promotions";
import { getShopNavItems } from "@/lib/data/navigation";

export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const navItems = getShopNavItems();
  const promoMessages = getPromoMessages();
  const mobileAccountLinks = getMobileAccountLinks({ isAuthenticated: false });

  return (
    <>
      <TopPromoBar messages={promoMessages} />
      <div className="sticky top-0 z-40 shadow-sm">
        <Navbar />
        <CategoriesBar navItems={navItems} />
      </div>
      <MobileMenu accountLinks={mobileAccountLinks} navItems={navItems} />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
    </>
  );
}
