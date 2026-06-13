export type AdminPeriodId = "today" | "current-week" | "last-30-days" | "last-90-days" | "last-12-months" | "all-time";

export type AdminPeriodOption = {
  id: AdminPeriodId;
  label: string;
  description: string;
};

// These values are display options only until backend filtering contracts exist.
// Mock data MUST remain static and independent from the selected period.
export const adminPeriodOptions: AdminPeriodOption[] = [
  { id: "today", label: "Hoy", description: "Vista del día" },
  { id: "current-week", label: "Semana actual", description: "Selección visual por defecto" },
  { id: "last-30-days", label: "Este mes / últimos 30 días", description: "Vista mensual" },
  { id: "last-90-days", label: "Trimestre / últimos 90 días", description: "Vista trimestral" },
  { id: "last-12-months", label: "Año / últimos 12 meses", description: "Vista anual" },
  { id: "all-time", label: "Siempre / histórico", description: "Histórico completo" },
];

export const defaultAdminPeriodId: AdminPeriodId = "current-week";
