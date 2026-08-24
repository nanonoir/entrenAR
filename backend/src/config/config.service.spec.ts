import * as assert from "node:assert/strict";

import { loadAppConfig, NODE_ENV } from "./app.config";

const validEnvironment = {
  DATABASE_URL: "postgresql://entrenar:password@127.0.0.1:5432/entrenar?schema=public",
  JWT_ACCESS_SECRET: "access-secret-with-at-least-thirty-two-characters",
  JWT_REFRESH_SECRET: "refresh-secret-with-at-least-thirty-two-characters",
};

describe("config.service", () => {
  it("loads validated defaults", () => {
    const config = loadAppConfig(validEnvironment);

    assert.equal(config.nodeEnv, NODE_ENV.DEVELOPMENT);
    assert.equal(config.port, 3001);
    assert.equal(config.throttleLimit, 100);
  });

  it("rejects missing JWT secrets", () => {
    assert.throws(
      () => loadAppConfig({ DATABASE_URL: validEnvironment.DATABASE_URL }),
      /Invalid backend configuration:[\s\S]*JWT_ACCESS_SECRET[\s\S]*JWT_REFRESH_SECRET/,
    );
  });
});
