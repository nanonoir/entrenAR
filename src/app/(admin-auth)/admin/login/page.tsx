import type { Metadata } from "next";

import { AdminLoginForm } from "@/components/admin/auth/AdminLoginForm";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Acceso administrativo | EntrenAR",
};

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <AdminLoginForm expired={params.expired === "true"} />;
}
