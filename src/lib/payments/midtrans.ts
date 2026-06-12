import crypto from "crypto";
import type { ChargeInput, ChargeResult, PaymentGateway, PaymentStatusValue, WebhookEvent } from "./gateway";

/**
 * Midtrans Snap — siap pakai: isi MIDTRANS_SERVER_KEY (+ MIDTRANS_IS_PRODUCTION)
 * lalu set PAYMENT_PROVIDER=midtrans. Tidak ada perubahan kode lain yang diperlukan.
 */
export class MidtransGateway implements PaymentGateway {
  readonly name = "midtrans";

  private get serverKey() {
    const key = process.env.MIDTRANS_SERVER_KEY;
    if (!key) throw new Error("MIDTRANS_SERVER_KEY belum diisi");
    return key;
  }

  private get baseUrl() {
    return process.env.MIDTRANS_IS_PRODUCTION === "true"
      ? "https://app.midtrans.com"
      : "https://app.sandbox.midtrans.com";
  }

  private get apiUrl() {
    return process.env.MIDTRANS_IS_PRODUCTION === "true"
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com";
  }

  private authHeader() {
    return `Basic ${Buffer.from(`${this.serverKey}:`).toString("base64")}`;
  }

  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    const res = await fetch(`${this.baseUrl}/snap/v1/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: this.authHeader() },
      body: JSON.stringify({
        transaction_details: { order_id: input.ref, gross_amount: input.amount },
        item_details: [{ id: input.ref, price: input.amount, quantity: 1, name: input.description.slice(0, 50) }],
        customer_details: {
          first_name: input.customer?.name,
          email: input.customer?.email,
          phone: input.customer?.phone,
        },
      }),
    });
    if (!res.ok) throw new Error(`Midtrans error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { token: string; redirect_url: string };
    return {
      ref: input.ref,
      providerRef: input.ref,
      status: "PENDING",
      redirectUrl: data.redirect_url,
      token: data.token,
    };
  }

  async getStatus(ref: string): Promise<PaymentStatusValue> {
    const res = await fetch(`${this.apiUrl}/v2/${ref}/status`, {
      headers: { Authorization: this.authHeader() },
    });
    const data = (await res.json()) as { transaction_status?: string };
    return mapStatus(data.transaction_status);
  }

  async parseWebhook(body: unknown): Promise<WebhookEvent> {
    const b = body as {
      order_id: string;
      status_code: string;
      gross_amount: string;
      signature_key: string;
      transaction_status: string;
    };
    const expected = crypto
      .createHash("sha512")
      .update(`${b.order_id}${b.status_code}${b.gross_amount}${this.serverKey}`)
      .digest("hex");
    if (expected !== b.signature_key) throw new Error("Signature webhook Midtrans tidak valid");
    return { ref: b.order_id, status: mapStatus(b.transaction_status), raw: body };
  }
}

function mapStatus(s?: string): PaymentStatusValue {
  switch (s) {
    case "capture":
    case "settlement":
      return "SETTLED";
    case "pending":
      return "PENDING";
    case "expire":
      return "EXPIRED";
    default:
      return "FAILED";
  }
}
