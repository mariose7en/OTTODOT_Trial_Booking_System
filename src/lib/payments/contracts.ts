/**
 * Provider-neutral payment contracts (payment_mockup.md §6 D1…D11, R11).
 * Everything above the provider layer — validation, envelopes, the
 * confirmBooking state machine — is shared, so `mock` and `stripe` behave
 * identically for callers.
 */

export type PaymentResult = "SUCCESS" | "FAILED";

export type PaymentIntentStatus =
  | "requires_payment_method"
  | "processing"
  | "succeeded"
  | "canceled";

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  metadata: Record<string, string>;
}

export interface ChargeResult {
  intent: PaymentIntent;
  result: PaymentResult;
}

export interface RefundResult {
  id: string;
  paymentIntentId: string;
  status: "succeeded" | "pending" | "failed";
  amount: number;
}

export type PaymentEventType =
  | "payment_intent.succeeded"
  | "payment_intent.payment_failed";

export interface PaymentEvent {
  id: string;
  type: PaymentEventType;
  created: number;
  data: { object: PaymentIntent };
}

export interface CreateIntentInput {
  amount: number;
  currency?: string;
  metadata: Record<string, string>;
}

export interface RefundInput {
  paymentIntentId: string;
  reason?: string;
  metadata?: Record<string, string>;
}

/**
 * The surface the payment routes use. Mock-only extras (charge, emit, plan,
 * reset, state) live on `MockControls` behind `getMockControls()`.
 */
export interface PaymentProvider {
  readonly name: "stripe" | "mock";
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
  refund(input: RefundInput): Promise<RefundResult>;
  /** Returns false when the `stripe-signature` header does not verify. */
  verifySignature(payload: string, header: string): boolean;
}
