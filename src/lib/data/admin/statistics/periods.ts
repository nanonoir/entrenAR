import { STATISTICS_PERIOD, type StatisticsPeriod } from "@/lib/api/admin/statistics/types";

export type AdminPeriodId = StatisticsPeriod;

export type AdminPeriodOption = {
  id: AdminPeriodId;
  label: string;
  description: string;
};

export const adminPeriodOptions: AdminPeriodOption[] = [
  { id: STATISTICS_PERIOD.TODAY, label: "Hoy", description: "Vista del día" },
  { id: STATISTICS_PERIOD.CURRENT_WEEK, label: "Semana actual", description: "Selección visual por defecto" },
  { id: STATISTICS_PERIOD.LAST_30_DAYS, label: "Este mes / últimos 30 días", description: "Vista mensual" },
  { id: STATISTICS_PERIOD.LAST_90_DAYS, label: "Trimestre / últimos 90 días", description: "Vista trimestral" },
  { id: STATISTICS_PERIOD.LAST_12_MONTHS, label: "Año / últimos 12 meses", description: "Vista anual" },
  { id: STATISTICS_PERIOD.ALL_TIME, label: "Siempre / histórico", description: "Histórico completo" },
  { id: STATISTICS_PERIOD.CUSTOM, label: "Rango personalizado", description: "Elegí un rango de fechas" },
];

export const defaultAdminPeriodId: AdminPeriodId = STATISTICS_PERIOD.CURRENT_WEEK;
