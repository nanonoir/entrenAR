import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";

import type { AppConfig } from "../../config/app.config";
import { PaymentAttentionService } from "./payment-attention.service";
import { PaymentNotificationProcessorService } from "./payment-notification-processor.service";
import { PaymentReconciliationService } from "./payment-reconciliation.service";

export const PAYMENT_WORKER_BATCH = 5;

interface WorkerDefinition {
  intervalMs: number;
  name: string;
  run: () => Promise<unknown>;
}

/**
 * Periodic wake-ups over durable PostgreSQL work. Timers are registered only when workers are enabled
 * (`PAYMENT_WORKERS_ENABLED`, off under NODE_ENV=test), so tests and CLI scripts never start them. A tick never
 * overlaps itself, and once shutdown begins no new work is claimed; unfinished rows are recovered by their leases.
 */
@Injectable()
export class PaymentWorkersService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(PaymentWorkersService.name);
  private readonly running = new Map<string, Promise<unknown>>();
  private readonly registeredIntervals: string[] = [];
  private stopping = false;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly registry: SchedulerRegistry,
    private readonly inbox: PaymentNotificationProcessorService,
    private readonly reconciliation: PaymentReconciliationService,
    private readonly attention: PaymentAttentionService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get("paymentWorkersEnabled", { infer: true })) return;

    const workers: WorkerDefinition[] = [
      { intervalMs: 5_000, name: "payment-inbox", run: () => this.inbox.processDue(PAYMENT_WORKER_BATCH) },
      { intervalMs: 15_000, name: "payment-expiry", run: () => this.reconciliation.expireDue(PAYMENT_WORKER_BATCH * 2) },
      { intervalMs: 15_000, name: "payment-reconcile", run: () => this.reconciliation.reconcileDue("pending", PAYMENT_WORKER_BATCH * 2) },
      { intervalMs: 60_000, name: "payment-financial", run: () => this.reconciliation.reconcileDue("financial", PAYMENT_WORKER_BATCH * 2) },
      { intervalMs: 60_000, name: "payment-attention", run: () => this.attention.sweep() },
    ];
    for (const worker of workers) {
      const timer = setInterval(() => void this.tick(worker), worker.intervalMs);
      timer.unref();
      this.registry.addInterval(worker.name, timer);
      this.registeredIntervals.push(worker.name);
    }
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    for (const name of this.registeredIntervals) this.registry.deleteInterval(name);
    this.registeredIntervals.length = 0;
    await Promise.allSettled([...this.running.values()]);
  }

  /** Runs one worker tick unless shutting down or the previous tick is still running. Exposed for tests. */
  async tick(worker: WorkerDefinition): Promise<void> {
    if (this.stopping || this.running.has(worker.name)) return;

    const pending = worker.run().catch((error: unknown) => {
      this.logger.warn(JSON.stringify({ error: error instanceof Error ? error.name : "unknown", event: "payment_worker_failed", worker: worker.name }));
    }).finally(() => {
      this.running.delete(worker.name);
    });
    this.running.set(worker.name, pending);
    await pending;
  }
}
