import { formatDate, formatTime } from "@/components/admin/discounts/discount-utils";
import type { CouponHistoryItem } from "@/lib/data/admin/discounts/types";

export function CouponHistory({ history }: { history: CouponHistoryItem[] }) {
  return (
    <aside className="rounded-3xl border border-border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-text">Historial</h2>
      <div className="mt-4 grid gap-3">
        {history.map((item) => (
          <div key={item.id} className="rounded-2xl bg-surface p-3">
            <p className="text-sm font-semibold text-text">{item.label}</p>
            <p className="text-xs text-text-muted">Por {item.userName}</p>
            <p className="mt-1 text-xs text-text-muted">{formatDate(item.createdAt)} · {formatTime(item.createdAt)}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
