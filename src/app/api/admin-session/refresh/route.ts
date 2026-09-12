import { NextRequest } from "next/server";

import { forwardAdminSession } from "../login/route";

export async function POST(request: NextRequest) {
  return forwardAdminSession(request, "/auth/admin/refresh");
}
