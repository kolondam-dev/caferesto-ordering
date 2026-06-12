/**
 * Abstraksi payment gateway.
 * Implementasi: MockGateway (default, dev) dan MidtransGateway (tinggal isi API key).
 * Ganti provider via env PAYMENT_PROVIDER=mock|midtrans — tidak ada perubahan kode lain.
 */

export type ChargeInput = {
  ref: string; // ID unik internal (order/booking payment ref)
  amount: number; // IDR
  description: string;
  customer?: { name?: string; email?: string; phone?: string };
};

export type ChargeResult = {
  ref: string;
  providerRef: string;
  status: PaymentStatusValue;
  /** URL/token halaman pembayaran (Snap redirect_url di Midtrans). Mock: null, langsung settle. */
  redirectUrl: string | null;
  token: string | null;
};

export type PaymentStatusValue = "PENDING" | "SETTLED" | "FAILED" | "EXPIRED";

export type WebhookEvent = {
  ref: string;
  status: PaymentStatusValue;
  raw: unknown;
};

export interface PaymentGateway {
  readonly name: string;
  createCharge(input: ChargeInput): Promise<ChargeResult>;
  getStatus(ref: string): Promise<PaymentStatusValue>;
  /** Verifikasi & parse notifikasi webhook dari provider. */
  parseWebhook(body: unknown, headers: Headers): Promise<WebhookEvent>;
}
