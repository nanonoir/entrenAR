import { Prisma } from "../../generated/prisma/client";
import { addMoney, multiplyMoney, normalizeMoney, subtractMoney } from "./money.utils";

describe("money utilities", () => {
  it("calculates decimal values without binary floating-point drift", () => {
    expect(multiplyMoney("125.50", 3).toFixed(2)).toBe("376.50");
    expect(addMoney("0.10", "0.20").toFixed(2)).toBe("0.30");
    expect(subtractMoney(new Prisma.Decimal("1000.00"), "100.00").toFixed(2)).toBe("900.00");
  });

  it.each(["1.001", Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects unsupported monetary input %p",
    (value) => {
      expect(() => normalizeMoney(value)).toThrow("valid monetary amount");
    },
  );
});
