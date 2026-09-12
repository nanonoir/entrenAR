import assert from "node:assert/strict";

process.env.ADMIN_GATE_SIGNING_SECRET = "test-admin-gate-signing-secret-with-32-bytes";

async function main() {
  const { createAdminGate } = await import("../../src/lib/admin/gate");
  const { proxy } = await import("../../src/proxy");
  const { NextRequest } = await import("next/server");
  const request = (url: string, gate?: string) => {
    const result = new NextRequest(url);
    if (gate) result.cookies.set("entrenar_admin_gate", gate);
    return result;
  };

  const missing = proxy(request("http://localhost:3000/admin/ventas"));
  assert.equal(missing.status, 404);
  const forged = proxy(request("http://localhost:3000/admin/ventas", `${createAdminGate()}.tampered`));
  assert.equal(forged.status, 404);
  assert.equal(await missing.text(), "Not Found");
  const rsc = new NextRequest("http://localhost:3000/admin/invented", { headers: { RSC: "1" } });
  assert.equal(proxy(rsc).status, 404);
  const expired = proxy(request("http://localhost:3000/admin/ventas", createAdminGate(Date.now() - 1_900_000, 1_800)));
  assert.equal(expired.status, 307);
  assert.equal(expired.headers.get("location"), "http://localhost:3000/admin/login?expired=true");
  const active = proxy(request("http://localhost:3000/admin/ventas", createAdminGate()));
  assert.equal(active.status, 200);
  const publicLogin = proxy(request("http://localhost:3000/admin/login"));
  assert.equal(publicLogin.status, 200);
  console.log("admin-route-cloaking harness: PASS (6 scenarios)");
}

void main();
