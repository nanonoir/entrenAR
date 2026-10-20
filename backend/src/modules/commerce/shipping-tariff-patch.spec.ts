import { buildTariffPatchEntries, planTariffPatch } from "./shipping-tariff-patch";

describe("shipping tariff patch", () => {
  const entries = buildTariffPatchEntries();

  it("allow-lists exactly ten provider bands with non-round targets above 12000", () => {
    expect(entries).toHaveLength(10);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(10);
    for (const entry of entries) {
      expect(entry.target).toBeGreaterThan(12000);
      expect(entry.target % 100).not.toBe(0);
      expect(Number.isFinite(entry.expectedCurrent)).toBe(true);
    }
    const correo = entries.filter((entry) => entry.id.startsWith("correo-argentino-")).map((entry) => entry.target);
    expect(correo).toEqual([12487, 14963, 17849, 21376, 28742]);
    expect([...correo].sort((a, b) => a - b)).toEqual(correo);
  });

  it("plans changes when live values match the expected previous values", () => {
    const plan = planTariffPatch(entries, entries.map((entry) => ({ cost: String(entry.expectedCurrent), id: entry.id })));
    expect(plan.safe).toBe(true);
    expect(plan.rows.every((row) => row.action === "change")).toBe(true);
  });

  it("is idempotent once targets are applied", () => {
    const plan = planTariffPatch(entries, entries.map((entry) => ({ cost: `${entry.target}.00`, id: entry.id })));
    expect(plan.safe).toBe(true);
    expect(plan.rows.every((row) => row.action === "unchanged")).toBe(true);
  });

  it("flags concurrent edits and missing rows as unsafe", () => {
    const live = entries.slice(1).map((entry) => ({ cost: String(entry.expectedCurrent), id: entry.id }));
    live[0] = { cost: "99999", id: entries[1]!.id };
    const plan = planTariffPatch(entries, live);
    expect(plan.safe).toBe(false);
    expect(plan.rows[0]?.action).toBe("missing");
    expect(plan.rows[1]?.action).toBe("conflict");
  });
});
