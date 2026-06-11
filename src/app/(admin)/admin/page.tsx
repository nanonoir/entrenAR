export default function AdminPage() {
  return (
    <section className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-black/30">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-400">
        CRM / Admin
      </p>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
        Admin workspace wrapper
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
        This route group establishes the initial admin surface. The CRM modules will be added here
        while the feature continues in the same branch.
      </p>
    </section>
  );
}
