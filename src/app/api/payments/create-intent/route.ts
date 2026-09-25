import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { createErrorResponse } from "@/lib/errors";
import { z } from "zod";

const CreatePaymentIntentSchema = z.object({
  booking_id: z.string().uuid("Invalid booking ID format"),
});

const TRIAL_CLASS_PRICE = 2000; // $20.00 in cents

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { booking_id } = CreatePaymentIntentSchema.parse(body);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, trial_class_id, status, students!inner(first_name, last_name)")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.status !== "PENDING_PAYMENT") {
      return NextResponse.json(
        { success: false, error: "Booking is not in pending payment status" },
        { status: 400 }
      );
    }

    const { data: trialClass, error: classError } = await supabase
      .from("trial_classes")
      .select("class_name, subject")
      .eq("id", booking.trial_class_id)
      .single();

    if (classError || !trialClass) {
      return NextResponse.json(
        { success: false, error: "Trial class not found" },
        { status: 404 }
      );
    }

    const student = booking.students as { first_name: string; last_name: string };

    const paymentIntent = await stripe.paymentIntents.create({
      amount: TRIAL_CLASS_PRICE,
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
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Create PaymentIntent");
  }
}
