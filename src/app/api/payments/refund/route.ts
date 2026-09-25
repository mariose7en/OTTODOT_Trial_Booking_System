import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { createErrorResponse } from "@/lib/errors";
import { z } from "zod";

const RefundSchema = z.object({
  booking_id: z.string().uuid("Invalid booking ID format"),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { booking_id, reason } = RefundSchema.parse(body);

    // Get booking with payment info
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        status,
        payment_attempts (id, txn_id, status)
      `)
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { success: false, error: "Only confirmed bookings can be refunded" },
        { status: 400 }
      );
    }

    // Find successful payment attempt with Stripe payment intent
    const successfulPayment = booking.payment_attempts?.find(
      (attempt: any) => attempt.status === "SUCCESS" && attempt.txn_id
    );

    if (!successfulPayment) {
      return NextResponse.json(
        { success: false, error: "No successful payment found for this booking" },
        { status: 400 }
      );
    }

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: successfulPayment.txn_id,
      reason: "requested_by_customer",
      metadata: {
        booking_id,
        admin_reason: reason || "Admin initiated refund",
      },
    });

    // Update booking status
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "REFUNDED" })
      .eq("id", booking_id);

    if (updateError) {
      console.error("Error updating booking status:", updateError);
    }

    // Record refund attempt
    const { error: attemptError } = await supabase
      .from("payment_attempts")
      .insert({
        booking_id,
        status: "SUCCESS",
        txn_id: refund.id,
      });

    if (attemptError) {
      console.error("Error recording refund attempt:", attemptError);
    }

    return NextResponse.json({
      success: true,
      data: {
        refund_id: refund.id,
        status: refund.status,
        amount: refund.amount,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Refund POST");
  }
}
