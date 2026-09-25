import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createErrorResponse } from "@/lib/errors";
import { z } from "zod";

const PaymentHistorySchema = z.object({
  user_id: z.string().uuid("Invalid user ID format"),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());
    const { user_id } = PaymentHistorySchema.parse(query);

    // Get all bookings for this user
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id")
      .eq("student_id", user_id);

    if (bookingsError) {
      throw bookingsError;
    }

    const bookingIds = (bookings || []).map((b) => b.id);

    if (bookingIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Get payment attempts for these bookings
    const { data: payments, error: paymentsError } = await supabase
      .from("payment_attempts")
      .select(`
        id,
        booking_id,
        status,
        txn_id,
        created_at,
        bookings (
          trial_classes (
            class_name,
            subject
          )
        )
      `)
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: false });

    if (paymentsError) {
      throw paymentsError;
    }

    return NextResponse.json({
      success: true,
      data: payments || [],
    });
  } catch (error) {
    return createErrorResponse(error, "Payment History GET");
  }
}
