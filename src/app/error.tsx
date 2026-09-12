"use client";

import { ErrorLayout } from "@/components/ui/ErrorLayout";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorLayout
      code="500"
      title="Algo salió mal"
      description="Ocurrió un problema inesperado. Reintentá la operación o volvé al inicio."
      primaryAction={{ label: "Reintentar", onClick: reset }}
      secondaryAction={{ href: "/", label: "Ir al inicio" }}
    />
  );
}
