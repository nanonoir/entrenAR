import { NextRequest, NextResponse } from "next/server";

import { ADMIN_GATE_COOKIE, adminGateCookieOptions, createAdminGate } from "@/lib/admin/gate";

const ADMIN_REFRESH_COOKIE = "entrenar_admin_refresh";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1").replace(/\/$/, "");

export async function POST(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;
  let status = 204;
  try {
    const upstream = await fetch(`${API_BASE_URL}/auth/admin/logout`, {
      cache: "no-store",
      headers: refreshToken ? { Cookie: `${ADMIN_REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}` } : undefined,
      method: "POST",
    });
    status = upstream.ok ? 204 : upstream.status;
  } catch {
    status = 503;
  }

  const expired = request.nextUrl.searchParams.get("mode") === "expired";
  const response = status === 204
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ ok: false, code: "ADMIN_LOGOUT_FAILED", message: "The administrator session could not be closed." }, { status });
  response.cookies.set(ADMIN_REFRESH_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/api/admin-session", sameSite: "lax", secure: isSecure(request) });
  if (expired) {
    response.cookies.set(ADMIN_GATE_COOKIE, createAdminGate(Date.now() - 60_000, 1), adminGateCookieOptions(request, 300));
  } else {
    response.cookies.set(ADMIN_GATE_COOKIE, "", adminGateCookieOptions(request, 0));
  }
  return response;
}

function isSecure(request: NextRequest): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "preview" || request.nextUrl.protocol === "https:";
}
