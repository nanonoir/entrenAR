"use client";

import "./globals.css";
import { ErrorLayout } from "@/components/ui/ErrorLayout";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-AR">
      <body>
        <ErrorLayout
          code="500"
          title="Algo salió mal"
          description="No pudimos cargar la aplicación. Reintentá o volvé al inicio para continuar."
          primaryAction={{ label: "Reintentar", onClick: reset }}
          secondaryAction={{ href: "/", label: "Ir al inicio" }}
        />
      </body>
    </html>
  );
}
