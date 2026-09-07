import * as assert from "node:assert/strict";

import { createCorsOriginValidator } from "../app.setup";
import { loadAppConfig, NODE_ENV } from "./app.config";

const validEnvironment = {
  DATABASE_URL: "postgresql://entrenar:password@127.0.0.1:5432/entrenar?schema=public",
  JWT_ACCESS_SECRET: "access-secret-with-at-least-thirty-two-characters",
  JWT_REFRESH_SECRET: "refresh-secret-with-at-least-thirty-two-characters",
};

describe("app.config", () => {
  it("loads validated defaults", () => {
    const config = loadAppConfig(validEnvironment);

    assert.equal(config.nodeEnv, NODE_ENV.DEVELOPMENT);
    assert.equal(config.port, 3001);
    assert.equal(config.throttleLimit, 100);
    assert.deepEqual(config.corsOrigins, ["http://localhost:3000"]);
  });

  it("parses configured frontend and legacy CORS origins", () => {
    const config = loadAppConfig({
      ...validEnvironment,
      CORS_ORIGIN: "https://legacy.example.com/",
      CORS_ORIGINS: "http://localhost:3000, https://preview.example.com/path",
      FRONTEND_URL: "https://store.example.com/",
    });

    assert.deepEqual(config.corsOrigins, [
      "http://localhost:3000",
      "https://preview.example.com",
      "https://store.example.com",
      "https://legacy.example.com",
    ]);
    assert.equal(config.frontendUrl, "https://store.example.com");
  });

  it("validates credentialed CORS origins and permits same-origin requests", () => {
    const validator = createCorsOriginValidator([
      "http://localhost:3000",
      "https://store.example.com",
    ]);
    const check = (origin: string | undefined): boolean => {
      let allowed = false;
      validator(origin, (error, result) => {
        assert.equal(error, null);
        allowed = result === true;
      });
      return allowed;
    };

    assert.equal(check(undefined), true);
    assert.equal(check("https://store.example.com/"), true);
    assert.equal(check("https://untrusted.example.com"), false);
  });

  it("rejects missing JWT secrets", () => {
    assert.throws(
      () => loadAppConfig({ DATABASE_URL: validEnvironment.DATABASE_URL }),
      /Invalid backend configuration:[\s\S]*JWT_ACCESS_SECRET[\s\S]*JWT_REFRESH_SECRET/,
    );
  });
});
