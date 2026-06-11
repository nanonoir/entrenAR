export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-white/10 bg-slate-900/80 px-6 py-8 lg:block">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-400">
            EntrenAR
          </p>
          <h1 className="mt-3 text-2xl font-bold">Admin CRM</h1>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Initial workspace for customer, product, and order management.
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/10 bg-slate-950/90 px-6 py-5">
            <p className="text-sm font-medium text-slate-400">Admin panel</p>
          </header>
          <main className="flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
