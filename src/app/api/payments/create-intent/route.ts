import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  createErrorResponse,
  BookingError,
  NotFoundError,
  rethrowIfDatabaseError,
} from "@/lib/errors";
import { bookingIdSchema } from "@/lib/validations/ids";
import { TRIAL_CLASS_PRICE_CENTS } from "@/lib/payments/price";
import { getPaymentProvider } from "@/lib/payments/provider";
import { z } from "zod";

const CreatePaymentIntentSchema = z.object({
  booking_id: bookingIdSchema,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { booking_id } = CreatePaymentIntentSchema.parse(body);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, trial_class_id, status, students!inner(first_name, last_name)")
      .eq("id", booking_id)
      .single();

    rethrowIfDatabaseError(bookingError);
    if (bookingError || !booking) {
      throw new NotFoundError("Booking", booking_id);
    }

    if (booking.status !== "PENDING_PAYMENT") {
      throw new BookingError("Booking is not in pending payment status");
    }

    const { data: trialClass, error: classError } = await supabase
      .from("trial_classes")
      .select("class_name, subject")
      .eq("id", booking.trial_class_id)
      .single();

    rethrowIfDatabaseError(classError);
    if (classError || !trialClass) {
      throw new NotFoundError("Trial class", booking.trial_class_id);
    }

    const studentData = booking.students as { first_name: string; last_name: string }[];
    const student = studentData[0];

    // Provider port (D5/R11): PayMock in dev/test, Stripe when configured
    const paymentIntent = await getPaymentProvider().createIntent({
      amount: TRIAL_CLASS_PRICE_CENTS,
      currency: "usd",
      metadata: {
        booking_id: booking.id,
        trial_class_id: booking.trial_class_id,
        student_name: `${student.first_name} ${student.last_name}`,
        class_name: trialClass.class_name,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        client_secret: paymentIntent.clientSecret,
        payment_intent_id: paymentIntent.id,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Create PaymentIntent");
  }
}
