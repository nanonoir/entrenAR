"use client";

import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";

export function TrackingAuthCTA() {
  const [hydrated, setHydrated] = useState(false);
  const user = useAuthStore((state) => state.user);
  const openAccountDrawer = useUIStore((state) => state.openAccountDrawer);

  useEffect(() => {
    Promise.resolve(useAuthStore.persist.rehydrate()).finally(() => setHydrated(true));
  }, []);

  if (!hydrated) {
    return <Button aria-label="Cargando acceso a pedidos" className="min-w-72" disabled size="lg" />;
  }

  if (user) {
    return (
      <LinkButton href="/mi-cuenta?seccion=pedidos" size="lg" variant="secondary">
        <Eye aria-hidden size={18} />
        Ver todos mis pedidos
      </LinkButton>
    );
  }

  return (
    <Button onClick={openAccountDrawer} size="lg" variant="secondary">
      Iniciar Sesión para ver todos los Pedidos
    </Button>
  );
}
