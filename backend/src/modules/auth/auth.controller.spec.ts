import "reflect-metadata";

import { AuthController } from "./auth.controller";

const THROTTLER_METADATA = {
  LIMIT: "THROTTLER:LIMIT",
  TTL: "THROTTLER:TTL",
} as const;

describe("auth.controller", () => {
  it("applies the five-request per-minute throttle to registration", () => {
    expectThrottle(AuthController.prototype.register);
  });

  it("applies the five-request per-minute throttle to login", () => {
    expectThrottle(AuthController.prototype.login);
  });

  it("applies the five-request per-minute throttle to password recovery", () => {
    expectThrottle(AuthController.prototype.forgotPassword);
  });
});

function expectThrottle(handler: object): void {
  expect(Reflect.getMetadata(`${THROTTLER_METADATA.LIMIT}default`, handler)).toBe(5);
  expect(Reflect.getMetadata(`${THROTTLER_METADATA.TTL}default`, handler)).toBe(60_000);
}
