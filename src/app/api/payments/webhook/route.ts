import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { success: false, error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { success: false, error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const bookingId = paymentIntent.metadata.booking_id;

        if (bookingId) {
          const { error: updateError } = await supabase
            .from("bookings")
            .update({ status: "CONFIRMED" })
            .eq("id", bookingId);

          if (updateError) {
            console.error("Error updating booking:", updateError);
          }

          const { error: attemptError } = await supabase
            .from("payment_attempts")
            .insert({
              booking_id: bookingId,
              status: "SUCCESS",
              txn_id: paymentIntent.id,
            });

          if (attemptError) {
            console.error("Error recording payment attempt:", attemptError);
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const bookingId = paymentIntent.metadata.booking_id;

        if (bookingId) {
          const { error: updateError } = await supabase
            .from("bookings")
            .update({ status: "PAYMENT_FAILED" })
            .eq("id", bookingId);

          if (updateError) {
            console.error("Error updating booking:", updateError);
          }

          const { error: attemptError } = await supabase
            .from("payment_attempts")
            .insert({
              booking_id: bookingId,
              status: "FAILED",
              txn_id: paymentIntent.id,
            });

          if (attemptError) {
            console.error("Error recording payment attempt:", attemptError);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { success: false, error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
