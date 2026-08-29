import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { AccountSectionPanel } from "@/components/shop/account/dashboard/AccountSectionPanel";
import { AccountSidebar } from "@/components/shop/account/dashboard/AccountSidebar";
import { cn } from "@/lib/utils";
import type { AccountAddress, AccountOrder, AccountProfile, AccountSection } from "@/types/account";
import type { ProductSummary } from "@/types/product";

type AccountLayoutProps = {
  activeSection: AccountSection;
  addresses: AccountAddress[];
  displayName: string;
  mobileContentOpen: boolean;
  onBackToMenu: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  onSelectSection: (section: AccountSection) => void;
  orders: AccountOrder[];
  products: ProductSummary[];
  profile: AccountProfile | null;
  userEmail: string;
};

export function AccountLayout({
  activeSection,
  addresses,
  displayName,
  mobileContentOpen,
  onBackToMenu,
  onLogout,
  isLoggingOut,
  onSelectSection,
  orders,
  products,
  profile,
  userEmail,
}: AccountLayoutProps) {
  return (
    <Container className="py-8 sm:py-10" size="wide">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-subtitle text-sm font-semibold uppercase text-accent">Mi cuenta</p>
          <h1 className="mt-1 font-heading text-5xl leading-none sm:text-6xl">Hola, {displayName}!</h1>
        </div>
        <Button disabled={isLoggingOut} onClick={onLogout} variant="secondary">
          {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <AccountSidebar
          activeSection={activeSection}
          hiddenOnMobile={mobileContentOpen}
          onSelectSection={onSelectSection}
        />

        <section className={cn("rounded-card border border-border bg-surface p-4 sm:p-6", !mobileContentOpen && "hidden lg:block")}>
          <Button className="mb-4 lg:hidden" onClick={onBackToMenu} variant="ghost">
            <ArrowLeft aria-hidden size={18} />
            Atrás
          </Button>
          <AccountSectionPanel
            activeSection={activeSection}
            addresses={addresses}
            key={profile?.email ?? userEmail}
            orders={orders}
            products={products}
            profile={profile}
            userEmail={userEmail}
          />
        </section>
      </div>
    </Container>
  );
}
