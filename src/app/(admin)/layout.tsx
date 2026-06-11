import { AdminLayoutShell } from "@/components/admin/layout/AdminLayoutShell";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
