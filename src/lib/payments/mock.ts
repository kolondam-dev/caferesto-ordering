import type { ChargeInput, ChargeResult, PaymentGateway, PaymentStatusValue, WebhookEvent } from "./gateway";

/**
 * Gateway mock: charge langsung SETTLED sehingga alur demo mulus,
 * namun bentuk respons identik dengan provider asli.
 */
export class MockGateway implements PaymentGateway {
  readonly name = "mock";

  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    return {
      ref: input.ref,
      providerRef: `MOCK-${input.ref}`,
      status: "SETTLED",
      redirectUrl: null,
      token: null,
    };
  }

  async getStatus(): Promise<PaymentStatusValue> {
    return "SETTLED";
  }

  async parseWebhook(body: unknown): Promise<WebhookEvent> {
    const b = body as { ref?: string; status?: PaymentStatusValue };
    return { ref: b.ref ?? "", status: b.status ?? "SETTLED", raw: body };
  }
}
