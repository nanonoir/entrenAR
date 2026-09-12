"use client";

import { ErrorLayout } from "@/components/ui/ErrorLayout";

export default function NotFound() {
  return (
    <ErrorLayout
      code="404"
      title="Esta página no existe"
      description="No encontramos lo que buscabas. Podés volver al catálogo y seguir explorando EntrenAR."
      primaryAction={{ href: "/productos", label: "Explorar catálogo" }}
      secondaryAction={{ label: "Volver atrás", onClick: () => window.history.back() }}
    />
  );
}
