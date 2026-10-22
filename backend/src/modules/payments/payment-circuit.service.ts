import { Inject, Injectable, Optional } from "@nestjs/common";

export const PAYMENT_CIRCUIT_COOLDOWN_MS_TOKEN = Symbol("PAYMENT_CIRCUIT_COOLDOWN_MS");
export const PAYMENT_CIRCUIT_COOLDOWN_MS = 5 * 60 * 1_000;

/**
 * Process-level flag opened when Mercado Pago rejects our credentials or configuration. While open, card payments are
 * unavailable (quote eligibility, new submits and retries) until the cooldown elapses or the process restarts.
 */
@Injectable()
export class PaymentCircuitService {
  private openUntil = 0;

  constructor(
    @Optional() @Inject(PAYMENT_CIRCUIT_COOLDOWN_MS_TOKEN) private readonly cooldownMs: number = PAYMENT_CIRCUIT_COOLDOWN_MS,
  ) {}

  open(): void {
    this.openUntil = Date.now() + this.cooldownMs;
  }

  isOpen(): boolean {
    return Date.now() < this.openUntil;
  }
}
