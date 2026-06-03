import Image from "next/image";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

type CheckoutLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function CheckoutLayout({ children }: CheckoutLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-text">
      <header className="border-b border-border bg-background">
        <Container className="flex min-h-20 items-center py-4" size="wide">
          <Link aria-label="Volver al inicio de EntrenAR" className="flex shrink-0 items-center" href="/">
            <Image alt="EntrenAR" height={42} priority src="/blackLogo.svg" width={150} />
          </Link>
        </Container>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-zinc-800 bg-zinc-950 text-white">
        <Container className="flex flex-col gap-3 py-6 text-sm text-white/75 sm:flex-row sm:items-center sm:justify-between" size="wide">
          <p>EntrenAR ©</p>
          <p className="inline-flex items-center gap-2 font-subtitle text-xs font-semibold uppercase tracking-[0.2em]">
            <LockKeyhole aria-hidden size={16} />
            Compra 100% segura. Datos cifrados.
          </p>
        </Container>
      </footer>
    </div>
  );
}
