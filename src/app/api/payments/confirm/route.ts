import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  BookingStatus,
  PaymentAttemptStatus,
  ApiResponse,
  BookingResponse,
} from "@/types/booking";
import { ConfirmPaymentSchema } from "@/lib/validations/booking";
import {
  DatabaseError,
  NotFoundError,
  createErrorResponse,
} from "@/lib/errors";

function generateAttemptId(): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ATTEMPT${random}-${date}`;
}

function generateTxnId(): string {
  return `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export async function POST(request: Request): Promise<
  NextResponse<ApiResponse<BookingResponse>>
> {
  try {
    const body = await request.json();
    const validatedData = ConfirmPaymentSchema.parse(body);

    const { booking_id, payment_result } = validatedData;

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      throw new NotFoundError("Booking", booking_id);
    }

    if (booking.status !== BookingStatus.PendingPayment) {
      return NextResponse.json(
        {
          success: false,
          error: `Booking is not in pending payment status. Current status: ${booking.status}`,
        },
        { status: 409 }
      );
    }

    const attemptId = generateAttemptId();
    const txnId = generateTxnId();

    const { error: attemptInsertError } = await supabase
      .from("payment_attempts")
      .insert({
        id: attemptId,
        booking_id,
        status: PaymentAttemptStatus.Initiated,
        txn_id: txnId,
      });

    if (attemptInsertError) {
      console.error("Error recording payment attempt:", attemptInsertError);
    }

    const { data, error } = await supabase.rpc("confirm_trial_booking", {
      p_booking_id: booking_id,
      p_payment_result: payment_result.toUpperCase(),
    });

    if (error) {
      console.error("RPC error:", error);

      await supabase
        .from("payment_attempts")
        .update({ status: PaymentAttemptStatus.Failed })
        .eq("id", attemptId);

      throw new DatabaseError("Payment processing failed", error);
    }

    const finalStatus =
      data === "CONFIRMED"
        ? PaymentAttemptStatus.Success
        : PaymentAttemptStatus.Failed;

    await supabase
      .from("payment_attempts")
      .update({ status: finalStatus })
      .eq("id", attemptId);

    return NextResponse.json({
      success: true,
      data: {
        booking_id,
        status: data as BookingStatus,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Payment Confirm POST");
  }
}
