import { AdminLayoutShell } from "@/components/admin/layout/AdminLayoutShell";
import { AdminBootstrapBoundary } from "@/components/admin/auth/AdminBootstrapBoundary";

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminBootstrapBoundary><AdminLayoutShell>{children}</AdminLayoutShell></AdminBootstrapBoundary>;
}
