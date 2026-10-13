import { identifyDatabaseTarget } from "../catalog-scraper/operations/database-target";
import { authorizeTarget, type ShowcaseAuthorization } from "./target-policy";
import { parseShowcaseArguments } from "./crm-showcase.command";
import { assertBaselinePrerequisites, type Baseline } from "./crm-showcase.service";

const URL_VALUE = "postgresql://demo:private@127.0.0.1:55439/entrenar_crm_demo_unit?schema=public";
function authorization(url = URL_VALUE): ShowcaseAuthorization {
  return { purpose: "crm-showcase-demo", destinationFingerprint: identifyDatabaseTarget(url).fingerprint, source: identifyDatabaseTarget("postgresql://source:private@127.0.0.1:5432/entrenar"), baselineDumpSha256: "a".repeat(64), baselineDigest: "b".repeat(64), schedulerDisabled: true, schedulerEvidence: "No demo application/jobs; checked task/container schedules.", sourcePersonalDataAbsent: true, separateInstance: true, serverAddress: "172.20.0.2" };
}

describe("CRM showcase destination policy", () => {
  it("accepts independently attested literal loopback isolation", () => {
    expect(authorizeTarget(URL_VALUE, authorization(), "test").identity.database).toBe("entrenar_crm_demo_unit");
  });
  it("never falls back to habitual DATABASE_URL", () => {
    const prior = process.env.DATABASE_URL;
    process.env.DATABASE_URL = URL_VALUE;
    try { expect(() => authorizeTarget(undefined, authorization(), "test")).toThrow("not authorized"); }
    finally { if (prior === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prior; }
  });
  it.each(["host", "hostaddr", "port", "dbname", "options", "search_path", "sslmode", "application_name", "connection_limit"])("rejects %s overrides before connecting", (key) => {
    expect(() => authorizeTarget(`${URL_VALUE}&${key}=override`, authorization(), "test")).toThrow("overrides");
  });
  it.each(["localhost", "demo.example.com", "192.168.1.2", "127.0.0.2"])("rejects non-literal authorized host %s", (host) => {
    const url = URL_VALUE.replace("127.0.0.1", host);
    expect(() => authorizeTarget(url, authorization(url), "test")).toThrow("loopback");
  });
  it.each(["entrenar", "postgres", "template1", "entrenar_crm_demo_bad-name"])("rejects unsafe database %s", (name) => {
    const url = URL_VALUE.replace("entrenar_crm_demo_unit", name);
    expect(() => authorizeTarget(url, authorization(url), "test")).toThrow("demo destination");
  });
  it.each(["schedulerDisabled", "sourcePersonalDataAbsent", "separateInstance"])("requires %s evidence", (key) => {
    expect(() => authorizeTarget(URL_VALUE, { ...authorization(), [key]: false }, "test")).toThrow("authorization");
  });
  it("rejects production, source port, fingerprint mismatch, non-public and duplicate schemas", () => {
    expect(() => authorizeTarget(URL_VALUE, authorization(), "production")).toThrow();
    expect(() => authorizeTarget(URL_VALUE.replace("55439", "5432"), authorization(URL_VALUE.replace("55439", "5432")), "test")).toThrow();
    expect(() => authorizeTarget(URL_VALUE, { ...authorization(), destinationFingerprint: "a".repeat(64) }, "test")).toThrow();
    expect(() => authorizeTarget(URL_VALUE.replace("public", "other"), authorization(), "test")).toThrow();
    expect(() => authorizeTarget(`${URL_VALUE}&schema=public`, authorization(), "test")).toThrow();
  });
});

describe("CRM showcase CLI arguments", () => {
  const args = ["--seed", "demo", "--reference-date", "2026-10-09T15:00:00Z", "--authorization", "private.json"];
  it("requires explicit seed and UTC instant", () => {
    expect(parseShowcaseArguments(args).referenceDate.toISOString()).toBe("2026-10-09T15:00:00.000Z");
  });
  it.each([[], ["--seed", "demo"], [...args, "--reset", "true"], [...args, "--seed", "other"], ["--database-url", "secret"]].map((value) => ({ args: value })))("rejects incomplete, duplicate or destructive switches", (value) => {
    expect(() => parseShowcaseArguments(value.args)).toThrow();
  });
  it.each(["2026-10-09", "invalid", "2026-02-30T15:00:00Z", "2026-10-09T15:00:00-03:00"])("rejects ambiguous reference %s", (value) => {
    expect(() => parseShowcaseArguments(args.map((item) => item === "2026-10-09T15:00:00Z" ? value : item))).toThrow();
  });
});

describe("explicit trusted-owner local exception", () => {
  const local = "postgresql://owner:private@127.0.0.1:5432/entrenar?schema=public";
  function trusted(): ShowcaseAuthorization {
    const value = authorization(local);
    return { ...value, purpose: "crm-showcase-trusted-owner-local", sourcePersonalDataAbsent: false, separateInstance: false, trustedOwner: true, restoreEvidence: { destination: identifyDatabaseTarget(URL_VALUE), dumpSha256: value.baselineDumpSha256, sourceBaselineDigest: "c".repeat(64), restoredBaselineDigest: "c".repeat(64), verified: true, description: "Private custom dump restored and canonical baseline compared on independent loopback instance." } };
  }
  it("accepts only explicit exact target plus backup restore evidence", () => {
    expect(authorizeTarget(local, trusted(), "development").identity.database).toBe("entrenar");
    expect(() => authorizeTarget(local, authorization(local), "development")).toThrow();
    expect(() => authorizeTarget(local, trusted(), "production")).toThrow();
    expect(() => authorizeTarget(undefined, trusted(), "development")).toThrow();
  });
  it.each(["5433/entrenar", "5432/entrenar_other"])("rejects different destination %s", (target) => {
    expect(() => authorizeTarget(local.replace("5432/entrenar", target), trusted(), "test")).toThrow("exact approved");
  });
  it("rejects missing, false, inconsistent or nonisolated restoration evidence", () => {
    const value = trusted();
    expect(() => authorizeTarget(local, { ...value, restoreEvidence: undefined }, "test")).toThrow();
    expect(() => authorizeTarget(local, { ...value, trustedOwner: false }, "test")).toThrow();
    for (const changed of [{ verified: false }, { dumpSha256: "d".repeat(64) }, { restoredBaselineDigest: "d".repeat(64) }, { destination: identifyDatabaseTarget(local) }]) {
      expect(() => authorizeTarget(local, { ...value, restoreEvidence: { ...value.restoreEvidence, ...changed } }, "test")).toThrow();
    }
  });
  it("allows preserved administrator tokens only with explicit trusted-owner baseline checks", () => {
    const baseline: Baseline = { Product: [{}], ProductVariant: [{}], ProductImage: [{}], ProductCategory: [{}], PaymentMethodConfig: [{ status: "ACTIVE" }], ShippingProvider: [{ status: "ACTIVE" }], PickupPoint: [{ status: "ACTIVE" }], User: [{ id: "admin", role: "ADMIN", email: "owner@real-domain.test", firstName: "Owner" }], RefreshToken: [{ userId: "admin" }] };
    expect(() => assertBaselinePrerequisites(baseline)).toThrow();
    expect(() => assertBaselinePrerequisites(baseline, true)).not.toThrow();
    expect(() => assertBaselinePrerequisites({ ...baseline, RefreshToken: [{ userId: "unknown" }] }, true)).toThrow("administrators");
    expect(() => assertBaselinePrerequisites({ ...baseline, User: [{ id: "admin", role: "CUSTOMER" }] }, true)).toThrow();
    expect(() => assertBaselinePrerequisites({ ...baseline, Order: [{ id: "unrelated" }] }, true)).toThrow();
  });
});
