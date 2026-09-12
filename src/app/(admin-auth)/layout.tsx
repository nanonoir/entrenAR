import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Acceso administrativo | EntrenAR",
};

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
