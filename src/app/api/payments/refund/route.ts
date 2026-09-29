import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  BookingError,
  DatabaseError,
  NotFoundError,
  createErrorResponse,
  rethrowIfDatabaseError,
} from "@/lib/errors";
import { bookingIdSchema } from "@/lib/validations/ids";
import { getPaymentProvider } from "@/lib/payments/provider";
import { PaymentAttemptStatus } from "@/types/booking";
import { z } from "zod";

const RefundSchema = z.object({
  booking_id: bookingIdSchema,
  reason: z.string().optional(),
});

const PAYMENT_INTENT_ID = /^pi_/;

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

    rethrowIfDatabaseError(bookingError);
    if (bookingError || !booking) {
      throw new NotFoundError("Booking", booking_id);
    }

    if (booking.status !== "CONFIRMED") {
      throw new BookingError("Only confirmed bookings can be refunded");
    }

    // Find the successful attempt that carries a real payment intent (D9):
    // legacy rows still hold our synthetic TXN-… id, which Stripe rejects.
    const successfulPayment = booking.payment_attempts?.find(
      (attempt: any) => attempt.status === PaymentAttemptStatus.Success && attempt.txn_id
    );

    if (!successfulPayment) {
      throw new BookingError("No successful payment found for this booking");
    }

    if (!PAYMENT_INTENT_ID.test(String(successfulPayment.txn_id))) {
      throw new BookingError(
        "No payment intent recorded for this booking"
      );
    }

    // Create the refund through the provider port (mock or Stripe, R11)
    const refund = await getPaymentProvider().refund({
      paymentIntentId: successfulPayment.txn_id,
      reason: "requested_by_customer",
      metadata: {
        booking_id,
        admin_reason: reason || "Admin initiated refund",
      },
    });

    // Update booking status — part of the same unit of work (D8)
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "REFUNDED" })
      .eq("id", booking_id);

    if (updateError) {
      throw new DatabaseError(
        "Failed to update booking status",
        updateError as unknown as Error
      );
    }

    // D9: the refund moves the successful attempt to REFUNDED — never a
    // second SUCCESS row, so the ledger keeps showing one payment.
    const { error: attemptError } = await supabase
      .from("payment_attempts")
      .update({ status: PaymentAttemptStatus.Refunded })
      .eq("id", successfulPayment.id);

    if (attemptError) {
      throw new DatabaseError(
        "Failed to record refund in the payment ledger",
        attemptError as unknown as Error
      );
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
