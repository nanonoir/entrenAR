import { DEFAULT_WEIGHT_BANDS, SHIPPING_PROVIDERS, weightBandCost } from "../showcase-reset/fixtures/catalog-commerce-baseline";

interface TariffPatchEntry { readonly expectedCurrent: number; readonly id: string; readonly target: number }
interface TariffPatchCurrent { readonly cost: number | string; readonly id: string }
type TariffPatchAction = "change" | "conflict" | "missing" | "unchanged";
interface TariffPatchRow extends TariffPatchEntry { readonly action: TariffPatchAction; readonly current: number | null }

/** Costs found on the local runtime before the owner-approved tariff decision (2026-10-19). */
const PREVIOUS_COSTS: Readonly<Record<string, readonly number[]>> = {
  andreani: [100, 100, 100, 100, 100],
  "correo-argentino": [7500, 10500, 15000, 22000, 30000],
};

/** Allow-list: exactly one entry per provider band; nothing else may be written. */
function buildTariffPatchEntries(): readonly TariffPatchEntry[] {
  return SHIPPING_PROVIDERS.flatMap((provider) => DEFAULT_WEIGHT_BANDS.map((band, index) => ({
    expectedCurrent: PREVIOUS_COSTS[provider.id]?.[index] ?? Number.NaN,
    id: `${provider.id}-${band.id}`,
    target: Number(weightBandCost(provider.id, band)),
  })));
}

/** A row is a conflict when the live value is neither the expected previous value nor the target (concurrent admin edit). */
function planTariffPatch(entries: readonly TariffPatchEntry[], current: readonly TariffPatchCurrent[]): { readonly rows: readonly TariffPatchRow[]; readonly safe: boolean } {
  const byId = new Map(current.map((row) => [row.id, Number(row.cost)]));
  const rows = entries.map((entry): TariffPatchRow => {
    const value = byId.get(entry.id);
    if (value === undefined) return { ...entry, action: "missing", current: null };
    if (value === entry.target) return { ...entry, action: "unchanged", current: value };
    if (value === entry.expectedCurrent) return { ...entry, action: "change", current: value };
    return { ...entry, action: "conflict", current: value };
  });
  return { rows, safe: rows.every((row) => row.action === "change" || row.action === "unchanged") };
}

export { buildTariffPatchEntries, planTariffPatch };
export type { TariffPatchEntry, TariffPatchRow };
