import { ConflictException, Injectable } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import { PaymentCircuitService } from "../payments/payment-circuit.service";
import { PaymentDispatchService } from "../payments/payment-dispatch.service";
import { PaymentStatusService, type PaymentOwner, type PaymentStatusView } from "../payments/payment-status.service";
import type { CheckoutCardPaymentRequest } from "./checkout.schemas";
import { CheckoutCompletionService } from "./checkout-completion.service";
import type { CheckoutActorContext } from "./checkout-quote.service";
import { CheckoutSnapshotBuilder } from "./checkout-snapshot.builder";

/**
 * Card payment entrypoint: atomic placement first, then the provider call in the same request after the placement
 * transaction has committed, then the normalized status. Replays never dispatch twice.
 */
@Injectable()
export class CheckoutCardPaymentService {
  constructor(
    private readonly completionService: CheckoutCompletionService,
    private readonly snapshotBuilder: CheckoutSnapshotBuilder,
    private readonly dispatcher: PaymentDispatchService,
    private readonly statusService: PaymentStatusService,
    private readonly circuit: PaymentCircuitService,
  ) {}

  async pay(input: CheckoutCardPaymentRequest, actor: CheckoutActorContext | undefined): Promise<PaymentStatusView> {
    if (this.circuit.isOpen()) {
      throw new ConflictException({
        code: ERROR_CODE.PAYMENT_METHOD_UNAVAILABLE,
        message: "Card payments are temporarily unavailable.",
        ok: false,
      });
    }

    const placement = await this.completionService.placeCardOrder(input, actor, this.snapshotBuilder);

    const outcome = placement.created
      ? await this.dispatcher.dispatch({
          attemptId: placement.attemptId,
          card: input.card,
          ...(input.deviceId ? { deviceId: input.deviceId } : {}),
        })
      : null;

    return this.statusService.viewOwnedOrder(placement.orderId, this.owner(input, actor), outcome?.challengeUrl);
  }

  /** The order bound to the caller's checkout (guest session) or, for customers, their latest pending card order. */
  async active(sessionToken: string | undefined, actor: CheckoutActorContext | undefined): Promise<PaymentStatusView | null> {
    return this.statusService.activeForOwner(this.owner({ sessionToken }, actor));
  }

  private owner(input: { sessionToken?: string | undefined }, actor: CheckoutActorContext | undefined): PaymentOwner {
    return {
      ...(actor?.role ? { role: actor.role } : {}),
      ...(input.sessionToken ? { sessionToken: input.sessionToken } : {}),
      ...(actor?.userId ? { userId: actor.userId } : {}),
    };
  }
}
