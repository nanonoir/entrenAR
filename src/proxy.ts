import { NextRequest, NextResponse } from "next/server";

import { ADMIN_GATE_COOKIE, inspectAdminGate } from "@/lib/admin/gate";

export const config = {
  matcher: ["/admin/:path*"],
};

export function proxy(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  const state = inspectAdminGate(request.cookies.get(ADMIN_GATE_COOKIE)?.value);

  if (pathname === "/admin/login") {
    if (state === "active") return NextResponse.redirect(new URL("/admin", request.url));
    return NextResponse.next();
  }

  if (state === "expired") {
    return NextResponse.redirect(new URL("/admin/login?expired=true", request.url));
  }

  if (state !== "active") {
    const acceptsHtml = request.headers.get("accept")?.includes("text/html") ?? false;
    if (request.headers.get("RSC") === "1" || !acceptsHtml) {
      return new NextResponse("Not Found", { status: 404 });
    }
    return NextResponse.rewrite(new URL("/__not-found", request.url));
  }

  return NextResponse.next();
}
