import assert from "node:assert/strict";

process.env.ADMIN_GATE_SIGNING_SECRET = "test-admin-gate-signing-secret-with-32-bytes";

async function main() {
  const { createAdminGate } = await import("../../src/lib/admin/gate");
  const { proxy } = await import("../../src/proxy");
  const { POST: refresh } = await import("../../src/app/api/admin-session/refresh/route");
  const { POST: login } = await import("../../src/app/api/admin-session/login/route");
  const { NextRequest } = await import("next/server");
  const realFetch = globalThis.fetch;

  const gateRequest = (url: string, gate?: string, headers?: Record<string, string>) => {
    const result = new NextRequest(url, { headers });
    if (gate) result.cookies.set("entrenar_admin_gate", gate);
    return result;
  };
  const sessionRequest = (url: string) => {
    const result = new NextRequest(url, { method: "POST" });
    result.cookies.set("entrenar_admin_refresh", "stale-token");
    result.cookies.set("entrenar_admin_gate", createAdminGate());
    result.cookies.set("entrenar_customer_session", "customer-keep");
    return result;
  };
  const mockUpstream = (status: number | "network") => {
    globalThis.fetch = (async () => {
      if (status === "network") throw new TypeError("fetch failed");
      return new Response(JSON.stringify({ code: "AUTH_UNAUTHORIZED", message: "no" }), { status });
    }) as typeof fetch;
  };
  const cleared = (response: Response) => {
    const setCookies = response.headers.getSetCookie();
    const find = (name: string) => setCookies.find((cookie) => cookie.startsWith(`${name}=;`));
    return { gate: find("entrenar_admin_gate"), refresh: find("entrenar_admin_refresh"), all: setCookies };
  };

  try {
    // Stale gate + rejected refresh clears both admin cookies with their original paths.
    for (const status of [401, 403] as const) {
      mockUpstream(status);
      const response = await refresh(sessionRequest("http://localhost:3000/api/admin-session/refresh"));
      assert.equal(response.status, status);
      const { gate, refresh: refreshCookie, all } = cleared(response);
      assert.ok(gate && /Path=\/admin(;|$)/i.test(gate) && /Max-Age=0/i.test(gate) && /HttpOnly/i.test(gate), "gate must be cleared on /admin");
      assert.ok(refreshCookie && /Path=\/api\/admin-session/i.test(refreshCookie) && /Max-Age=0/i.test(refreshCookie) && /HttpOnly/i.test(refreshCookie), "refresh must be cleared");
      assert.ok(!all.some((cookie) => /customer|cart/i.test(cookie)), "customer/cart cookies must be untouched");
      assert.ok(!/Secure/i.test(gate), "http localhost is not Secure");
    }

    // Secure flags over https.
    mockUpstream(401);
    const secure = cleared(await refresh(sessionRequest("https://shop.example/api/admin-session/refresh")));
    assert.ok(secure.gate && /Secure/i.test(secure.gate) && /SameSite=lax/i.test(secure.gate));
    assert.ok(secure.refresh && /Secure/i.test(secure.refresh) && /SameSite=lax/i.test(secure.refresh));

    // Outage keeps cookies.
    for (const status of [500, 502, 503, "network"] as const) {
      mockUpstream(status);
      const response = await refresh(sessionRequest("http://localhost:3000/api/admin-session/refresh"));
      assert.equal(response.status, status === "network" ? 503 : status);
      assert.equal(response.headers.getSetCookie().length, 0, `outage ${status} must not touch cookies`);
    }

    // Failed login (bad credentials) does not clear an existing session in another tab.
    mockUpstream(401);
    const badLogin = await login(new NextRequest("http://localhost:3000/api/admin-session/login", { body: "{}", method: "POST" }));
    assert.equal(badLogin.status, 401);
    assert.equal(badLogin.headers.getSetCookie().length, 0);

    // Malformed refresh token is rejected upstream and cleared; token never echoed.
    mockUpstream(401);
    const malformed = new NextRequest("http://localhost:3000/api/admin-session/refresh", { method: "POST" });
    malformed.cookies.set("entrenar_admin_refresh", "%%%not a token;;");
    const malformedResponse = await refresh(malformed);
    assert.ok(cleared(malformedResponse).refresh);
    assert.ok(!(await malformedResponse.text()).includes("not a token"));
  } finally {
    globalThis.fetch = realFetch;
  }

  // Proxy behaviour.
  const active = createAdminGate();
  const base = "http://localhost:3000";
  const normalLogin = proxy(gateRequest(`${base}/admin/login`, active));
  assert.equal(normalLogin.status, 307);
  assert.equal(normalLogin.headers.get("location"), `${base}/admin`);
  const slashLogin = proxy(gateRequest(`${base}/admin/login/`, active));
  assert.equal(slashLogin.status, 307, "trailing slash is treated as login");
  assert.equal(proxy(gateRequest(`${base}/admin/login/`)).status, 200);
  assert.equal(proxy(gateRequest(`${base}/admin/login?expired=true`, active)).status, 200, "expired=true breaks the stale-gate loop");
  assert.equal(proxy(gateRequest(`${base}/admin/login/?expired=true`, active)).status, 200);
  assert.equal(proxy(gateRequest(`${base}/admin/login?expired=true`)).status, 200);
  assert.equal(proxy(gateRequest(`${base}/admin/ventas?expired=true`)).status, 404, "expired flag never grants internal access");
  assert.equal(proxy(gateRequest(`${base}/admin/ventas/?expired=true`, "garbage")).status, 404);
  assert.equal(proxy(gateRequest(`${base}/admin/ventas`, active)).status, 200);
  const rsc = proxy(gateRequest(`${base}/admin/ventas?expired=true`, undefined, { RSC: "1" }));
  assert.equal(rsc.status, 404);
  assert.equal(await rsc.text(), "Not Found");

  console.log("admin-stale-gate-recovery harness: PASS (refresh clearing, outage retention, proxy login/expired/slash/cloaking)");
}

main().catch((error) => { console.error(error); process.exit(1); });
