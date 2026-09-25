import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  BookingStatus,
  PaymentAttemptStatus,
  ConfirmPaymentRequest,
  ApiResponse,
  BookingResponse,
} from "@/types/booking";

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
    const body: ConfirmPaymentRequest = await request.json();
    const { booking_id, payment_result } = body;

    if (!booking_id || !payment_result) {
      return NextResponse.json(
        { success: false, error: "booking_id and payment_result are required" },
        { status: 400 }
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

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
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
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
