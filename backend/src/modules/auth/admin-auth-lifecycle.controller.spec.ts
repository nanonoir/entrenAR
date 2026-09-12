import "reflect-metadata";

import { RefreshSessionType } from "../../generated/prisma/enums";
import type { AuthService } from "./auth.service";
import { AdminAuthLifecycleController } from "./admin-auth-lifecycle.controller";

describe("admin-auth-lifecycle.controller", () => {
  it("keeps the lifecycle surface under auth/admin and uses the ADMIN policy", async () => {
    const service = createService();
    const controller = new AdminAuthLifecycleController(service as unknown as AuthService);
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };

    const result = await controller.login(
      { email: "admin@entrenar.test", password: "correct-password" },
      response as never,
    );

    expect(service.loginAdmin).toHaveBeenCalledWith("admin@entrenar.test", "correct-password");
    expect(result).toEqual(expect.objectContaining({ sessionType: RefreshSessionType.ADMIN }));
    expect(response.cookie).toHaveBeenCalledWith(
      "entrenar_admin_refresh",
      "admin-refresh-token",
      expect.objectContaining({ maxAge: 1_800_000, path: "/api/v1/auth/admin" }),
    );
    expect(Reflect.getMetadata("path", AdminAuthLifecycleController)).toBe("auth/admin");
    expect(Reflect.getMetadata("path", AdminAuthLifecycleController.prototype.login)).toBe("login");
  });

  it("passes only ADMIN refresh credentials to logout", async () => {
    const service = createService();
    const controller = new AdminAuthLifecycleController(service as unknown as AuthService);
    const response = { clearCookie: jest.fn() };

    await controller.logout(
      { headers: { cookie: "entrenar_admin_refresh=admin-refresh-token" } } as never,
      response as never,
    );

    expect(service.logout).toHaveBeenCalledWith("admin-refresh-token", RefreshSessionType.ADMIN);
    expect(service.logout).not.toHaveBeenCalledWith(expect.anything(), RefreshSessionType.CUSTOMER);
  });
});

interface AdminAuthServiceMock {
  getRefreshCookieOptions: jest.Mock;
  loginAdmin: jest.Mock;
  logout: jest.Mock;
  refresh: jest.Mock;
}

function createService(): AdminAuthServiceMock {
  const session = {
    accessToken: "admin-access-token",
    accessTokenExpiresAt: new Date("2026-09-11T00:15:00.000Z"),
    idleExpiresAt: new Date("2026-09-11T00:30:00.000Z"),
    refreshToken: "admin-refresh-token",
    sessionType: RefreshSessionType.ADMIN,
    user: { id: "admin-1", email: "admin@entrenar.test", role: "ADMIN" },
  };

  return {
    getRefreshCookieOptions: jest.fn((sessionType = RefreshSessionType.CUSTOMER) => ({
      httpOnly: true,
      maxAge: sessionType === RefreshSessionType.ADMIN ? 1_800_000 : 2_592_000_000,
      path: "/api/v1/auth",
      sameSite: "lax" as const,
      secure: false,
    })),
    loginAdmin: jest.fn().mockResolvedValue(session),
    logout: jest.fn().mockResolvedValue(undefined),
    refresh: jest.fn().mockResolvedValue(session),
  };
}
