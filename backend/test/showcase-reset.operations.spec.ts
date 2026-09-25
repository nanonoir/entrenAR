import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PROJECT_DIRECTORY = "/opt/entrenar";
const RESET_SCRIPT = "node dist/src/modules/showcase-reset/showcase-reset.command.js";
const SERVICE_EXEC_START = "/usr/bin/docker compose --project-directory /opt/entrenar exec -T backend npm run showcase:reset";

describe("showcase reset production invocation", () => {
  it("uses one fixed, tokenized compose command for manual and scheduled execution", async () => {
    const [packageJson, service] = await Promise.all([
      readFile(join(process.cwd(), "package.json"), "utf8"),
      readFile(deploymentPath("entrenar-showcase-reset.service"), "utf8"),
    ]);

    expect(JSON.parse(packageJson) as unknown).toMatchObject({ scripts: { "showcase:reset": RESET_SCRIPT } });
    expect(service).toContain(`WorkingDirectory=${PROJECT_DIRECTORY}`);
    expect(service).toContain(`ExecStart=${SERVICE_EXEC_START}`);
    expect(service).toContain("Type=oneshot");
    expect(service).toContain("StandardOutput=journal");
    expect(service).toContain("StandardError=journal");
    expect(service).not.toMatch(/(?:sh|bash)\s+-c|\$\{|\|\|\s*true/);
  });

  it("runs hourly without catch-up and keeps failures visible to systemd", async () => {
    const [service, timer] = await Promise.all([
      readFile(deploymentPath("entrenar-showcase-reset.service"), "utf8"),
      readFile(deploymentPath("entrenar-showcase-reset.timer"), "utf8"),
    ]);

    expect(timer).toContain("OnCalendar=hourly");
    expect(timer).toContain("Persistent=false");
    expect(timer).toContain("Unit=entrenar-showcase-reset.service");
    expect(service).not.toMatch(/^Restart=/m);
  });
});

function deploymentPath(fileName: string): string {
  return join(process.cwd(), "..", "deploy", "systemd", fileName);
}
