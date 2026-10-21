import { Injectable } from "@nestjs/common";

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
  ) {}

  async pay(input: CheckoutCardPaymentRequest, actor: CheckoutActorContext | undefined): Promise<PaymentStatusView> {
    const placement = await this.completionService.placeCardOrder(input, actor, this.snapshotBuilder);

    if (placement.created) {
      await this.dispatcher.dispatch({
        attemptId: placement.attemptId,
        card: input.card,
        ...(input.deviceId ? { deviceId: input.deviceId } : {}),
      });
    }

    return this.statusService.viewOwnedOrder(placement.orderId, this.owner(input, actor));
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
