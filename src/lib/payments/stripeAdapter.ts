/**
 * Stripe adapter (payment_mockup §6 D5/R11): same `PaymentProvider` contract as
 * PayMock, wrapping `src/lib/stripe.ts` — which is lazy, so importing this
 * module never throws (B16 fixed).
 */
import type {
  CreateIntentInput,
  PaymentIntent,
  PaymentProvider,
  RefundResult,
} from "@/lib/payments/contracts";
import { stripe } from "@/lib/stripe";

const STRIPE_REFUND_REASONS = new Set([
  "duplicate",
  "fraudulent",
  "requested_by_customer",
]);

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    const intent = await stripe.paymentIntents.create({
      amount: input.amount,
      currency: input.currency ?? "usd",
      metadata: input.metadata,
    });
    return {
      id: intent.id,
      clientSecret: intent.client_secret ?? "",
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status as PaymentIntent["status"],
      metadata: input.metadata,
    };
  },

  async refund(input): Promise<RefundResult> {
    const refund = await stripe.refunds.create({
      payment_intent: input.paymentIntentId,
      reason: input.reason && STRIPE_REFUND_REASONS.has(input.reason)
        ? (input.reason as "requested_by_customer")
        : "requested_by_customer",
      metadata: input.metadata,
    });
    return {
      id: refund.id,
      paymentIntentId: input.paymentIntentId,
      status: (refund.status as RefundResult["status"]) ?? "succeeded",
      amount: refund.amount ?? 0,
    };
  },

  verifySignature(payload: string, header: string): boolean {
    try {
      stripe.webhooks.constructEvent(
        payload,
        header,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
      return true;
    } catch {
      return false;
    }
  },
};
