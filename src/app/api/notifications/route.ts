import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import {
  bookingConfirmedTemplate,
  paymentFailedTemplate,
  bookingReminderTemplate,
} from "@/lib/email-templates";
import { createErrorResponse } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const { type, booking_id } = await request.json();

    if (!type || !booking_id) {
      return NextResponse.json(
        { success: false, error: "type and booking_id are required" },
        { status: 400 }
      );
    }

    // Get booking with related data
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        status,
        students (
          first_name,
          last_name,
          parents (
            first_name,
            last_name,
            email
          )
        ),
        trial_classes (
          class_name,
          subject,
          start_time,
          end_time,
          location
        )
      `)
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      );
    }

    const student = booking.students as any;
    const parent = student?.parents as any;
    const trialClass = booking.trial_classes as any;

    if (!student || !parent || !trialClass) {
      return NextResponse.json(
        { success: false, error: "Incomplete booking data" },
        { status: 400 }
      );
    }

    let emailSent = false;

    switch (type) {
      case "booking_confirmed": {
        const html = bookingConfirmedTemplate({
          studentName: `${student.first_name} ${student.last_name}`,
          parentName: `${parent.first_name} ${parent.last_name}`,
          className: trialClass.class_name,
          subject: trialClass.subject,
          startTime: trialClass.start_time,
          endTime: trialClass.end_time,
          location: trialClass.location,
          bookingId: booking.id,
        });

        emailSent = await sendEmail({
          to: parent.email,
          subject: `Booking Confirmed - ${trialClass.class_name}`,
          html,
        });
        break;
      }

      case "payment_failed": {
        const html = paymentFailedTemplate({
          parentName: `${parent.first_name} ${parent.last_name}`,
          studentName: `${student.first_name} ${student.last_name}`,
          className: trialClass.class_name,
          bookingId: booking.id,
        });

        emailSent = await sendEmail({
          to: parent.email,
          subject: `Payment Failed - ${trialClass.class_name}`,
          html,
        });
        break;
      }

      case "booking_reminder": {
        const html = bookingReminderTemplate({
          parentName: `${parent.first_name} ${parent.last_name}`,
          studentName: `${student.first_name} ${student.last_name}`,
          className: trialClass.class_name,
          subject: trialClass.subject,
          startTime: trialClass.start_time,
          location: trialClass.location,
        });

        emailSent = await sendEmail({
          to: parent.email,
          subject: `Reminder: ${trialClass.class_name} is tomorrow!`,
          html,
        });
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown notification type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: {
        email_sent: emailSent,
        type,
        booking_id,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Notifications POST");
  }
}
