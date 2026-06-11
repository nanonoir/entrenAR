import { AdminComingSoonState } from "@/components/admin/ui/States";

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Gestión</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">{title}</h1>
      </div>
      <AdminComingSoonState />
    </div>
  );
}
