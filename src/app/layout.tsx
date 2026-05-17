import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EntrenAR | Suplementos y accesorios deportivos",
  description:
    "Tienda de suplementos, accesorios y alimentos funcionales para entrenar mejor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
