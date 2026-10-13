import { createHash } from "node:crypto";

export const SHOWCASE_VERSION = "1";
export const SHOWCASE_NAMESPACE = "crm-showcase:";
export const COMPLETION_ID = "crm-showcase:completion";
export const SHOWCASE_COUNTS = { customers: 20, orders: 80, suppliers: 3, purchases: 4, coupons: 6, abandonments: 8 } as const;
export interface ScenarioInput { seed: string; referenceDate: Date; }
export interface ScenarioOrder { index: number; createdAt: Date; customerIndex: number; checkout: boolean; stateIndex: number; }
export interface Scenario { input: ScenarioInput; id: (role: string, index: string | number) => string; orders: ScenarioOrder[]; }

export function assembleScenario(input: ScenarioInput): Scenario {
  if (!input.seed.trim() || input.seed.length > 200 || !Number.isFinite(input.referenceDate.getTime())) throw new Error("Showcase seed and reference instant are required.");
  const identity = [SHOWCASE_VERSION, input.seed, input.referenceDate.toISOString()];
  const id = (role: string, index: string | number) => SHOWCASE_NAMESPACE + digest([...identity, role, index]);
  const orders = Array.from({ length: SHOWCASE_COUNTS.orders }, (_, index) => {
    const days = index < 3 ? index : 1 + (Number.parseInt(digest([...identity, "day", index]).slice(0, 8), 16) % 59);
    return { index, createdAt: new Date(input.referenceDate.getTime() - days * 86_400_000 - index * 600_000), customerIndex: index % SHOWCASE_COUNTS.customers, checkout: index % 4 !== 3, stateIndex: index < 3 ? 2 : (index + Math.floor(index / SHOWCASE_COUNTS.customers) * 3) % 10 };
  }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || compareId(id("order", a.index), id("order", b.index)));
  return { input, id, orders };
}

export function digest(value: unknown): string { return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }
export function compareId(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    if ("toJSON" in value && typeof value.toJSON === "function") return canonical(value.toJSON());
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => compareId(a, b)).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}
