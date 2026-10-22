import { cardPaymentMethodType, cardTokenDigest, sanitizeChallengeUrl } from "./payment-card";
import { buildCreateOrderRequest, moneyString, PAYMENT_STATEMENT_DESCRIPTOR } from "./payment-request.builder";

describe("cardPaymentMethodType", () => {
  it("maps supported brands to the server-side card type", () => {
    expect(cardPaymentMethodType("visa")).toBe("credit_card");
    expect(cardPaymentMethodType("debvisa")).toBe("debit_card");
  });

  it("rejects unknown ids, including prototype keys", () => {
    expect(cardPaymentMethodType("pix")).toBeUndefined();
    expect(cardPaymentMethodType("toString")).toBeUndefined();
    expect(cardPaymentMethodType("__proto__")).toBeUndefined();
  });
});

describe("sanitizeChallengeUrl", () => {
  it.each([
    "https://www.mercadopago.com.ar/3ds/challenge?id=1",
    "https://api.mercadolibre.com/challenge",
    "https://mercadopago.com/x",
  ])("accepts %s", (url) => {
    expect(sanitizeChallengeUrl(url)).toBeDefined();
  });

  it.each([
    undefined,
    "",
    "not a url",
    "http://www.mercadopago.com.ar/challenge",
    "https://evil.example.com/mercadopago.com",
    "https://mercadopago.com.evil.example.com/challenge",
    "https://notmercadopago.com/challenge",
    "https://user:pass@www.mercadopago.com.ar/challenge",
    "https://www.mercadopago.com.ar:8443/challenge",
    "javascript:alert(1)",
  ])("omits %s", (url) => {
    expect(sanitizeChallengeUrl(url)).toBeUndefined();
  });
});

describe("cardTokenDigest", () => {
  it("is deterministic and never contains the token", () => {
    const digest = cardTokenDigest("card-token-12345");

    expect(digest).toBe(cardTokenDigest("card-token-12345"));
    expect(digest).not.toContain("card-token-12345");
    expect(digest).toHaveLength(64);
  });
});

describe("moneyString", () => {
  it("formats through cents without float drift", () => {
    expect(moneyString(12345.67)).toBe("12345.67");
    expect(moneyString("0.1")).toBe("0.10");
    expect(moneyString({ toString: () => "75.00" })).toBe("75.00");
    expect(moneyString(0.1 + 0.2)).toBe("0.30");
  });

  it("rejects negative and non-finite values", () => {
    expect(() => moneyString(-1)).toThrow();
    expect(() => moneyString(Number.NaN)).toThrow();
  });
});

describe("buildCreateOrderRequest", () => {
  const snapshot = {
    customerEmail: "customer@example.test",
    customerFirstName: "Ana",
    customerLastName: "Gomez",
    expectedAmount: "175.00",
    items: [
      { productName: "Whey Pro", quantity: 2, sku: "WHEY-1KG", unitPrice: 75, variantName: "Vanilla" },
      { productName: "Shaker", quantity: 1, sku: "SHK-1", unitPrice: { toString: () => "25.00" }, variantName: null },
    ],
    orderId: "order-1",
  };
  const card = {
    installments: 3,
    payerEmail: "payer@example.test",
    payerIdentification: { number: "12345678", type: "DNI" },
    paymentMethodId: "master",
    token: "tok_123456789",
  };

  it("derives every amount, item and identity from the server snapshot", () => {
    const request = buildCreateOrderRequest(snapshot, card, "device-1");

    expect(request).toMatchObject({
      deviceId: "device-1",
      externalReference: "order-1",
      payer: { email: "payer@example.test", firstName: "Ana", lastName: "Gomez" },
      payment: {
        amount: "175.00",
        installments: 3,
        paymentMethodId: "master",
        paymentMethodType: "credit_card",
        statementDescriptor: PAYMENT_STATEMENT_DESCRIPTOR,
        token: "tok_123456789",
      },
      totalAmount: "175.00",
    });
    expect(request.items).toEqual([
      { externalCode: "WHEY-1KG", quantity: 2, title: "Whey Pro - Vanilla", unitPrice: "75.00" },
      { externalCode: "SHK-1", quantity: 1, title: "Shaker", unitPrice: "25.00" },
    ]);
  });

  it("omits the device id when none was supplied and rejects unsupported brands", () => {
    expect(buildCreateOrderRequest(snapshot, card, undefined)).not.toHaveProperty("deviceId");
    expect(() => buildCreateOrderRequest(snapshot, { ...card, paymentMethodId: "pix" }, undefined)).toThrow();
  });
});
