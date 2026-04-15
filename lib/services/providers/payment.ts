/**
 * Payment provider interface.
 *
 * Current state: No payment processor integrated.
 * Deposits are submitted as requests and manually approved by admins (Phase 9).
 *
 * When automated payment processing is needed:
 *   1. Pick a provider suitable for your region:
 *      GLOBAL → Stripe
 *      CN     → Alipay (支付宝), WeChat Pay (微信支付)
 *   2. Create an adapter in lib/services/adapters/payment/<provider>.ts
 *      that implements this interface.
 *   3. Register it in lib/services/registry.ts.
 *   4. Set NEXT_PUBLIC_PAYMENT_PROVIDER in .env.
 *
 * Note: This interface is intentionally minimal for MVP.
 * Extend it (webhooks, refunds, disputes) as needed.
 */

export interface CreatePaymentIntentParams {
  /** Amount in the smallest currency unit (e.g. cents for USD, fen for CNY) */
  amount: number;
  /** ISO 4217 currency code (e.g. 'usd', 'cny', 'usdt') */
  currency: string;
  /** Internal user ID for attribution */
  userId: string;
  /** Optional key-value metadata to attach to the payment record */
  metadata?: Record<string, string>;
}

export interface PaymentIntent {
  /** Provider-assigned payment intent ID */
  id: string;
  /**
   * Client secret or redirect URL — passed to the frontend SDK.
   * For Stripe: clientSecret for PaymentElement.
   * For Alipay/WeChat Pay: redirect URL or QR code payload.
   */
  clientSecret: string;
  status: "pending" | "succeeded" | "failed" | "cancelled";
}

export interface PaymentProvider {
  /** Create a payment intent and return it to the frontend. */
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>;

  /** Confirm a payment (server-side confirmation where applicable). */
  confirmPayment(intentId: string): Promise<PaymentIntent>;

  /** Cancel a pending payment intent. */
  cancelPayment(intentId: string): Promise<void>;
}
