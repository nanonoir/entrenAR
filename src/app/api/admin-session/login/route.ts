import { NextRequest, NextResponse } from "next/server";

import { ADMIN_GATE_COOKIE, adminGateCookieOptions, createAdminGate } from "@/lib/admin/gate";

const ADMIN_REFRESH_COOKIE = "entrenar_admin_refresh";
const ADMIN_REFRESH_PATH = "/api/admin-session";
const ADMIN_REFRESH_MAX_AGE = 1_800;
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1").replace(/\/$/, "");

type AdminSessionResponse = {
  accessToken?: string;
  accessTokenExpiresAt?: string;
  idleExpiresAt?: string;
  refreshToken?: string;
  sessionType?: string;
  user?: unknown;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  return forwardAdminSession(request, "/auth/admin/login", await readBody(request));
}

export async function forwardAdminSession(request: NextRequest, endpoint: string, body?: unknown): Promise<NextResponse> {
  try {
    const headers = new Headers({ Accept: "application/json" });
    if (body !== undefined) headers.set("Content-Type", "application/json");
    const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;
    if (refreshToken) headers.set("Cookie", `${ADMIN_REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}`);
    const upstream = await fetch(`${API_BASE_URL}${endpoint}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      headers,
      method: "POST",
    });
    const payload = await readPayload(upstream);
    if (!upstream.ok) return safeError(upstream.status, payload);
    const session = payload as AdminSessionResponse;
    if (typeof session.accessToken !== "string" || typeof session.refreshToken !== "string") {
      return safeError(502, { code: "ADMIN_AUTH_INVALID_RESPONSE", message: "The administrator session response was invalid." });
    }

    const response = NextResponse.json(publicSession(session), { status: upstream.status });
    response.cookies.set(ADMIN_REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      maxAge: ADMIN_REFRESH_MAX_AGE,
      path: ADMIN_REFRESH_PATH,
      sameSite: "lax",
      secure: isSecure(request),
    });
    response.cookies.set(ADMIN_GATE_COOKIE, createAdminGate(), adminGateCookieOptions(request, ADMIN_REFRESH_MAX_AGE + 300));
    return response;
  } catch {
    return safeError(503, { code: "ADMIN_AUTH_UNAVAILABLE", message: "The administrator session is unavailable." });
  }
}

function publicSession(session: AdminSessionResponse): Omit<AdminSessionResponse, "refreshToken"> {
  return {
    accessToken: session.accessToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    idleExpiresAt: session.idleExpiresAt,
    sessionType: session.sessionType,
    user: session.user,
  };
}

function isSecure(request: NextRequest): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "preview" || request.nextUrl.protocol === "https:";
}

async function readBody(request: NextRequest): Promise<unknown> {
  try { return await request.json(); } catch { return undefined; }
}

async function readPayload(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return undefined; }
}

function safeError(status: number, value: unknown): NextResponse {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return NextResponse.json({
    code: typeof record.code === "string" ? record.code : "ADMIN_AUTH_FAILED",
    message: typeof record.message === "string" ? record.message : "The administrator session request failed.",
    ok: false,
  }, { status });
}
