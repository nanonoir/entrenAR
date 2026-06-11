import { cn } from "@/lib/utils";

export function AdminCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("min-w-0 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm", className)}>{children}</section>;
}

export function AdminCardHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
    </div>
  );
}
