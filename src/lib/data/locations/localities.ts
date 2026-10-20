import { CHECKOUT_PROVINCES } from "./provinces";

export type CheckoutLocality = { id: string; name: string };

type LocalityRow = readonly [string, string];

const LOCALITY_LOADERS: Readonly<Record<string, () => Promise<{ default: unknown }>>> = {
  "02": () => import("./snapshots/localities/02.json"),
  "06": () => import("./snapshots/localities/06.json"),
  "10": () => import("./snapshots/localities/10.json"),
  "14": () => import("./snapshots/localities/14.json"),
  "18": () => import("./snapshots/localities/18.json"),
  "22": () => import("./snapshots/localities/22.json"),
  "26": () => import("./snapshots/localities/26.json"),
  "30": () => import("./snapshots/localities/30.json"),
  "34": () => import("./snapshots/localities/34.json"),
  "38": () => import("./snapshots/localities/38.json"),
  "42": () => import("./snapshots/localities/42.json"),
  "46": () => import("./snapshots/localities/46.json"),
  "50": () => import("./snapshots/localities/50.json"),
  "54": () => import("./snapshots/localities/54.json"),
  "58": () => import("./snapshots/localities/58.json"),
  "62": () => import("./snapshots/localities/62.json"),
  "66": () => import("./snapshots/localities/66.json"),
  "70": () => import("./snapshots/localities/70.json"),
  "74": () => import("./snapshots/localities/74.json"),
  "78": () => import("./snapshots/localities/78.json"),
  "82": () => import("./snapshots/localities/82.json"),
  "86": () => import("./snapshots/localities/86.json"),
  "90": () => import("./snapshots/localities/90.json"),
  "94": () => import("./snapshots/localities/94.json"),
};

export const LOCALITY_PROVINCE_IDS: readonly string[] = Object.keys(LOCALITY_LOADERS);

const cache = new Map<string, readonly CheckoutLocality[]>();

/** Loads one province's Georef localities on demand; unknown provinces resolve to an empty list. */
export async function loadProvinceLocalities(provinceId: string): Promise<readonly CheckoutLocality[]> {
  const cached = cache.get(provinceId);
  if (cached) return cached;
  const loader = LOCALITY_LOADERS[provinceId];
  if (!loader || !CHECKOUT_PROVINCES.some((province) => province.id === provinceId)) return [];
  const loaded = await loader();
  const rows = loaded.default as readonly LocalityRow[];
  const localities = rows.map(([id, name]) => ({ id, name }));
  cache.set(provinceId, localities);
  return localities;
}

const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").toLocaleLowerCase().trim();
}

/** Accent-insensitive search: prefix matches first, then contains; capped to keep the listbox small. */
export function searchLocalities(localities: readonly CheckoutLocality[], query: string, limit = 12): CheckoutLocality[] {
  const needle = normalizeSearchText(query);
  if (!needle) return localities.slice(0, limit);
  const starts: CheckoutLocality[] = [];
  const contains: CheckoutLocality[] = [];
  for (const locality of localities) {
    const haystack = normalizeSearchText(locality.name);
    if (haystack.startsWith(needle)) starts.push(locality);
    else if (haystack.includes(needle)) contains.push(locality);
  }
  return [...starts, ...contains].slice(0, limit);
}
