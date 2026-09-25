import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { bookingReminderTemplate } from "@/lib/email-templates";

export async function POST() {
  try {
    // Get tomorrow's date range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // Find confirmed bookings for classes tomorrow
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        id,
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
          location
        )
      `)
      .eq("status", "CONFIRMED")
      .gte("trial_classes.start_time", tomorrow.toISOString())
      .lt("trial_classes.start_time", dayAfterTomorrow.toISOString());

    if (bookingsError) {
      throw bookingsError;
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: "No reminders to send",
          count: 0,
        },
      });
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const booking of bookings) {
      const student = booking.students as any;
      const parent = student?.parents as any;
      const trialClass = booking.trial_classes as any;

      if (!student || !parent || !trialClass) {
        continue;
      }

      const html = bookingReminderTemplate({
        parentName: `${parent.first_name} ${parent.last_name}`,
        studentName: `${student.first_name} ${student.last_name}`,
        className: trialClass.class_name,
        subject: trialClass.subject,
        startTime: trialClass.start_time,
        location: trialClass.location,
      });

      const sent = await sendEmail({
        to: parent.email,
        subject: `Reminder: ${trialClass.class_name} is tomorrow!`,
        html,
      });

      if (sent) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Sent ${sentCount} reminders, ${failedCount} failed`,
        count: sentCount,
        failed: failedCount,
      },
    });
  } catch (error) {
    console.error("[Send Reminders]", error);
    return NextResponse.json(
      { success: false, error: "Failed to send reminders" },
      { status: 500 }
    );
  }
}
