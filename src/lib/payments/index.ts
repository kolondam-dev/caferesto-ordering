import type { PaymentGateway } from "./gateway";
import { MockGateway } from "./mock";
import { MidtransGateway } from "./midtrans";

export function getGateway(): PaymentGateway {
  return process.env.PAYMENT_PROVIDER === "midtrans" ? new MidtransGateway() : new MockGateway();
}

export * from "./gateway";
