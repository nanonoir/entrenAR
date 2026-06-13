import { AlertTriangle } from "lucide-react";

export function GlobalFormError({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle aria-hidden size={18} className="mt-0.5 shrink-0 text-amber-600" />
      <span>{message}</span>
    </div>
  );
}
