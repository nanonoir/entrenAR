import { AdminMobileNav } from "@/components/admin/layout/MobileNav";
import { AdminSidebar } from "@/components/admin/layout/Sidebar";
import { AdminToastContainer } from "@/components/admin/sales-flow/AdminToastContainer";

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 md:pb-8 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
      <AdminMobileNav />
      <AdminToastContainer />
    </div>
  );
}
