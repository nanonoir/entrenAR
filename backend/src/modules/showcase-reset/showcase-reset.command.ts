import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { AppModule } from "../../app.module";
import { SHOWCASE_RESET_OUTCOME, ShowcaseResetReport } from "./showcase-reset.report";
import { ShowcaseResetService } from "./showcase-reset.service";

async function runShowcaseResetCommand(): Promise<number> {
  let application: INestApplicationContext | undefined;
  const failureReport = new ShowcaseResetReport(randomUUID());
  try {
    application = await NestFactory.createApplicationContext(AppModule, { abortOnError: false, logger: false });
    const result = await application.get(ShowcaseResetService).run();
    process.stdout.write(`${JSON.stringify(result.report)}\n`);
    return result.exitCode;
  } catch {
    process.stdout.write(`${JSON.stringify(failureReport.complete(SHOWCASE_RESET_OUTCOME.FAILED, "unexpected"))}\n`);
    return 1;
  } finally {
    await application?.close();
  }
}

runShowcaseResetCommand().then((exitCode) => {
  process.exitCode = exitCode;
});

export { runShowcaseResetCommand };
