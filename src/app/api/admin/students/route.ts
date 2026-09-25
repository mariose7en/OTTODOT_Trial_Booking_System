import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select(`
        id,
        first_name,
        last_name,
        email,
        grade,
        created_at,
        bookings (id)
      `)
      .order("created_at", { ascending: false });

    if (studentsError) {
      throw studentsError;
    }

    const studentsWithBookingCount = (students || []).map((student) => ({
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      email: student.email,
      grade: student.grade,
      created_at: student.created_at,
      booking_count: student.bookings?.length || 0,
    }));

    return NextResponse.json({
      success: true,
      data: studentsWithBookingCount,
    });
  } catch (error) {
    return createErrorResponse(error, "Admin Students GET");
  }
}
