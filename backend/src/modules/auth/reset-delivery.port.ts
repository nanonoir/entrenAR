import { Injectable } from "@nestjs/common";

export const RESET_DELIVERY_PORT = Symbol("RESET_DELIVERY_PORT");

export interface PasswordResetDelivery {
  email: string;
  expiresAt: Date;
  token: string;
}

export interface ResetDeliveryPort {
  deliverPasswordReset(delivery: PasswordResetDelivery): Promise<void>;
}

@Injectable()
export class NoopResetDelivery implements ResetDeliveryPort {
  async deliverPasswordReset(delivery: PasswordResetDelivery): Promise<void> {
    void delivery;
    return Promise.resolve();
  }
}
