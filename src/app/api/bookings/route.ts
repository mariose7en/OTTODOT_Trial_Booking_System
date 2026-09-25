import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  BookingStatus,
  CreateBookingRequest,
  ApiResponse,
  BookingResponse,
  Booking,
} from "@/types/booking";

function generateSmartId(prefix: string, residentialId: string): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  return `${prefix}-${residentialId}-${date}`;
}

function generateBookingId(): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `BOOKING${random}-${date}`;
}

export async function GET(): Promise<
  NextResponse<ApiResponse<Booking[]>>
> {
  try {
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*")
      .order("registered_at", { ascending: false });

    if (error) {
      console.error("Error fetching bookings:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch bookings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: bookings as Booking[],
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<
  NextResponse<ApiResponse<BookingResponse>>
> {
  try {
    const body: CreateBookingRequest = await request.json();
    const {
      parent_first_name,
      parent_last_name,
      parent_email,
      parent_residential_id,
      student_first_name,
      student_last_name,
      student_residential_id,
      trial_class_id,
    } = body;

    if (
      !parent_first_name ||
      !parent_last_name ||
      !parent_email ||
      !parent_residential_id ||
      !student_first_name ||
      !student_last_name ||
      !student_residential_id ||
      !trial_class_id
    ) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 }
      );
    }

    const { data: trialClass, error: classError } = await supabase
      .from("trial_classes")
      .select("id, max_seats")
      .eq("id", trial_class_id)
      .single();

    if (classError || !trialClass) {
      return NextResponse.json(
        { success: false, error: "Trial class not found" },
        { status: 404 }
      );
    }

    const parentInitials = `${parent_first_name[0]}${parent_last_name[0]}`;
    const parentId = generateSmartId(parentInitials, parent_residential_id);

    const { data: existingParent } = await supabase
      .from("parents")
      .select("id")
      .eq("email", parent_email)
      .single();

    let actualParentId = parentId;
    if (existingParent) {
      actualParentId = existingParent.id;
    } else {
      const { error: parentError } = await supabase.from("parents").insert({
        id: parentId,
        first_name: parent_first_name,
        last_name: parent_last_name,
        residential_id: parent_residential_id,
        email: parent_email,
      });

      if (parentError) {
        console.error("Error creating parent:", parentError);
        return NextResponse.json(
          { success: false, error: "Failed to create parent record" },
          { status: 500 }
        );
      }
    }

    const studentInitials = `${student_first_name[0]}${student_last_name[0]}`;
    const studentId = generateSmartId(studentInitials, student_residential_id);

    const { data: existingStudent } = await supabase
      .from("students")
      .select("id")
      .eq("residential_id", student_residential_id)
      .eq("parent_id", actualParentId)
      .single();

    let actualStudentId = studentId;
    if (existingStudent) {
      actualStudentId = existingStudent.id;
    } else {
      const { error: studentError } = await supabase.from("students").insert({
        id: studentId,
        parent_id: actualParentId,
        first_name: student_first_name,
        last_name: student_last_name,
        residential_id: student_residential_id,
      });

      if (studentError) {
        console.error("Error creating student:", studentError);
        return NextResponse.json(
          { success: false, error: "Failed to create student record" },
          { status: 500 }
        );
      }
    }

    const { count: confirmedCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("trial_class_id", trial_class_id)
      .eq("status", BookingStatus.Confirmed);

    const seatsRemaining = trialClass.max_seats - (confirmedCount || 0);

    if (seatsRemaining <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No seats available for this class",
        },
        { status: 409 }
      );
    }

    const bookingId = generateBookingId();
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        id: bookingId,
        student_id: actualStudentId,
        trial_class_id,
        status: BookingStatus.PendingPayment,
      })
      .select()
      .single();

    if (bookingError) {
      console.error("Error creating booking:", bookingError);
      return NextResponse.json(
        { success: false, error: "Failed to create booking" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        booking_id: booking.id,
        status: booking.status as BookingStatus,
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
