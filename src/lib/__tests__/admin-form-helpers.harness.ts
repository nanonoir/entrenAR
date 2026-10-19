import { hasFormChanges } from "../admin-form-dirty";
import { shortReference } from "../formatting/short-reference";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(!hasFormChanges({ a: undefined, b: "", c: 1 }, { a: Number.NaN, b: undefined, c: 1 }), "Empty-equivalent values must not count as changes.");
assert(!hasFormChanges({ ids: [], x: { y: "" } }, { ids: [], x: {} }), "Empty nested values must not count as changes.");
assert(hasFormChanges({ code: "" }, { code: "NANO10" }), "A typed value must count as a change.");
assert(hasFormChanges({ ids: [] }, { ids: ["a"] }), "A selected item must count as a change.");

assert(shortReference("EN-0001") === "EN-0001", "Short references stay unchanged.");
const hash = "crm-showcase:" + "a".repeat(64);
assert(shortReference(hash).length < 14 && shortReference(hash).endsWith("aaaa"), "Long ids must be shortened.");

console.log("admin form helpers harness: dirty comparison and short references passed");
