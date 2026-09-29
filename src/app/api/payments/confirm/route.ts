import { NextResponse } from "next/server";
import { ConfirmPaymentSchema } from "@/lib/validations/booking";
import { createErrorResponse } from "@/lib/errors";
import { confirmBooking } from "@/lib/payments/confirmBooking";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { booking_id, payment_result } = ConfirmPaymentSchema.parse(body);

    const outcome = await confirmBooking({
      booking_id,
      result: payment_result,
      source: "http",
      txn_id: typeof body.payment_intent_id === "string" ? body.payment_intent_id : undefined,
    });

    if (outcome.kind !== "applied") {
      // The http guard above already 409s; this is a defensive fallback.
      return NextResponse.json({ success: true, data: outcome });
    }

    return NextResponse.json({
      success: true,
      data: {
        booking_id,
        status: outcome.status,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Payment Confirm POST");
  }
}
