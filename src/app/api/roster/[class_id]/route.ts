import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { BookingStatus, ApiResponse, RosterResponse } from "@/types/booking";
import { RosterParamsSchema } from "@/lib/validations/booking";
import {
  NotFoundError,
  DatabaseError,
  createErrorResponse,
} from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: { class_id: string } }
): Promise<NextResponse<ApiResponse<RosterResponse>>> {
  try {
    const { class_id } = params;

    const validatedParams = RosterParamsSchema.parse({ class_id });

    const { data: trialClass, error: classError } = await supabase
      .from("trial_classes")
      .select("id, class_name, max_seats")
      .eq("id", validatedParams.class_id)
      .single();

    if (classError || !trialClass) {
      throw new NotFoundError("Trial class", validatedParams.class_id);
    }

    const { data: bookings, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        student_id,
        students (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("trial_class_id", validatedParams.class_id)
      .eq("status", BookingStatus.Confirmed);

    if (bookingError) {
      throw new DatabaseError("Failed to fetch roster", bookingError);
    }

    const confirmedStudents = (bookings || []).map((booking) => {
      const student = booking.students as {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
      };
      return {
        student_id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
      };
    });

    const seatsRemaining = trialClass.max_seats - confirmedStudents.length;

    return NextResponse.json({
      success: true,
      data: {
        class_id: trialClass.id,
        class_name: trialClass.class_name,
        confirmed_students: confirmedStudents,
        seats_remaining: seatsRemaining,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Roster GET");
  }
}
