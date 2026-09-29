import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { BadRequestError, createErrorResponse } from "@/lib/errors";
import { getPaymentProvider } from "@/lib/payments/provider";
import { confirmBooking } from "@/lib/payments/confirmBooking";
import type { PaymentEventType } from "@/lib/payments/contracts";

function isPaymentEvent(type: string): type is PaymentEventType {
  return (
    type === "payment_intent.succeeded" || type === "payment_intent.payment_failed"
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return createErrorResponse(
      new BadRequestError("Missing stripe-signature header"),
      "Payment Webhook"
    );
  }

  if (!getPaymentProvider().verifySignature(body, sig)) {
    return createErrorResponse(
      new BadRequestError("Invalid signature"),
      "Payment Webhook"
    );
  }

  let event: Stripe.Event;
  try {
    event = JSON.parse(body) as Stripe.Event;
  } catch {
    return createErrorResponse(
      new BadRequestError("Invalid payload"),
      "Payment Webhook"
    );
  }

  try {
    if (isPaymentEvent(event.type)) {
      const paymentIntent = event.data?.object as
        | { id?: string; metadata?: { booking_id?: string } }
        | undefined;
      const bookingId = paymentIntent?.metadata?.booking_id;

      if (bookingId) {
        // Single writer (D7): no direct bookings UPDATE here — the state
        // machine in confirmBooking decides, and the RPC applies the change.
        const outcome = await confirmBooking({
          booking_id: bookingId,
          result:
            event.type === "payment_intent.succeeded" ? "SUCCESS" : "FAILED",
          source: "webhook",
          txn_id: paymentIntent?.id,
        });

        if (outcome.kind === "ignored") {
          // I5/I8: duplicate or out-of-order deliveries are acknowledged with
          // zero writes so Stripe retries stop without side effects.
          return NextResponse.json({
            success: true,
            data: { ignored: true, reason: outcome.reason, status: outcome.status },
          });
        }
      }
    } else {
      console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error, "Payment Webhook");
  }
}
