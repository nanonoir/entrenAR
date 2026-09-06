"use client";

import { useId, useState } from "react";

import { STATISTICS_PERIOD, type StatisticsPeriod } from "@/lib/api/admin/statistics/types";
import { adminPeriodOptions } from "@/lib/data/admin/statistics/periods";
import { useAdminStatisticsStore, type StatisticsCustomRange } from "@/stores/admin-statistics-store";

export interface PeriodFilterProps {
  value?: StatisticsPeriod;
  onChange?: (period: StatisticsPeriod, customRange?: StatisticsCustomRange) => void;
}

const emptyRange: StatisticsCustomRange = { from: "", to: "" };

export function PeriodFilter({ onChange, value }: PeriodFilterProps = {}) {
  const storePeriod = useAdminStatisticsStore((state) => state.period);
  const customRange = useAdminStatisticsStore((state) => state.customRange);
  const setStorePeriod = useAdminStatisticsStore((state) => state.setPeriod);
  const period = value ?? storePeriod;
  const [draftRange, setDraftRange] = useState<StatisticsCustomRange | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const visibleRange = draftRange ?? customRange ?? emptyRange;
  const id = useId();
  const periodId = `statistics-period-${id}`;
  const fromId = `statistics-from-${id}`;
  const toId = `statistics-to-${id}`;
  const periodHelpId = `statistics-period-help-${id}`;
  const rangeHelpId = `statistics-range-help-${id}`;

  const notifyPeriodChange = (nextPeriod: StatisticsPeriod, nextRange?: StatisticsCustomRange) => {
    void setStorePeriod(nextPeriod, nextRange);
    onChange?.(nextPeriod, nextRange);
  };

  const handlePeriodChange = (nextPeriod: StatisticsPeriod) => {
    setDraftRange(null);
    setRangeError(null);
    const nextRange = nextPeriod === STATISTICS_PERIOD.CUSTOM && customRange && isCompleteValidRange(customRange) ? customRange : undefined;
    notifyPeriodChange(nextPeriod, nextRange);
  };

  const handleRangeChange = (field: keyof StatisticsCustomRange, nextValue: string) => {
    const nextRange = { ...visibleRange, [field]: nextValue };
    setDraftRange(nextRange);
    const validationError = validateRange(nextRange);
    setRangeError(validationError);
    if (validationError) return;
    setDraftRange(null);
    notifyPeriodChange(STATISTICS_PERIOD.CUSTOM, nextRange);
  };

  return (
    <div className="grid gap-3 text-sm font-medium text-zinc-700 sm:max-w-md">
      <label className="grid gap-2" htmlFor={periodId}>
        Período
        <select
          id={periodId}
          aria-describedby={periodHelpId}
          className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-base text-zinc-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm"
          value={period}
          onChange={(event) => handlePeriodChange(event.currentTarget.value as StatisticsPeriod)}
        >
          {adminPeriodOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span id={periodHelpId} className="text-xs font-normal text-zinc-500">Los reportes se actualizan con el período seleccionado.</span>
      </label>

      {period === STATISTICS_PERIOD.CUSTOM ? (
        <fieldset className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
          <legend className="sr-only">Rango personalizado</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2" htmlFor={fromId}>
              Desde
              <input
                id={fromId}
                aria-describedby={rangeHelpId}
                aria-invalid={Boolean(rangeError)}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-base text-zinc-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm aria-[invalid=true]:border-red-400"
                max={visibleRange.to || undefined}
                type="date"
                value={visibleRange.from}
                onChange={(event) => handleRangeChange("from", event.currentTarget.value)}
              />
            </label>
            <label className="grid gap-2" htmlFor={toId}>
              Hasta
              <input
                id={toId}
                aria-describedby={rangeHelpId}
                aria-invalid={Boolean(rangeError)}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-base text-zinc-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 md:text-sm aria-[invalid=true]:border-red-400"
                min={visibleRange.from || undefined}
                type="date"
                value={visibleRange.to}
                onChange={(event) => handleRangeChange("to", event.currentTarget.value)}
              />
            </label>
          </div>
          <p id={rangeHelpId} className={rangeError ? "text-xs font-medium text-red-600" : "text-xs font-normal text-zinc-500"} role={rangeError ? "alert" : undefined}>
            {rangeError ?? "Seleccioná un rango de fechas, desde la fecha inicial hasta la final."}
          </p>
        </fieldset>
      ) : null}
    </div>
  );
}

function isCompleteValidRange(range: StatisticsCustomRange): boolean {
  return validateRange(range) === null;
}

function validateRange(range: StatisticsCustomRange): string | null {
  if (!range.from || !range.to) return "Completá ambas fechas para aplicar el rango.";
  if (!isValidDate(range.from) || !isValidDate(range.to)) return "Ingresá fechas válidas.";
  if (range.from > range.to) return "La fecha inicial debe ser anterior o igual a la fecha final.";
  return null;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
