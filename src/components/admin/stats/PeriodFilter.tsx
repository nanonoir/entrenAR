"use client";

import { useState } from "react";
import { adminPeriodOptions, defaultAdminPeriodId, type AdminPeriodId } from "@/lib/data/admin/statistics/periods";

export function PeriodFilter() {
  const [period, setPeriod] = useState<AdminPeriodId>(defaultAdminPeriodId);

  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-700 sm:max-w-xs">
      Período
      <select
        className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-base text-zinc-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm"
        value={period}
        onChange={(event) => setPeriod(event.target.value as AdminPeriodId)}
      >
        {adminPeriodOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {/* Visual-only in the mock stage: do not sync this selection to URL params or mutate mock data. */}
    </label>
  );
}
