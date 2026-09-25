import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  BookingStatus,
  CreateBookingRequest,
  ApiResponse,
  BookingResponse,
  Booking,
} from "@/types/booking";
import {
  CreateBookingSchema,
  BookingQuerySchema,
} from "@/lib/validations/booking";
import {
  ValidationError,
  DatabaseError,
  NotFoundError,
  ConflictError,
  createErrorResponse,
} from "@/lib/errors";

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

export async function GET(request: Request): Promise<
  NextResponse<ApiResponse<Booking[]>>
> {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());

    const validatedQuery = BookingQuerySchema.parse(query);

    let queryBuilder = supabase
      .from("bookings")
      .select("*")
      .order("registered_at", { ascending: false });

    if (validatedQuery.status) {
      queryBuilder = queryBuilder.eq("status", validatedQuery.status);
    }

    if (validatedQuery.trial_class_id) {
      queryBuilder = queryBuilder.eq(
        "trial_class_id",
        validatedQuery.trial_class_id
      );
    }

    const { data: bookings, error } = await queryBuilder;

    if (error) {
      throw new DatabaseError("Failed to fetch bookings", error);
    }

    return NextResponse.json({
      success: true,
      data: bookings as Booking[],
    });
  } catch (error) {
    return createErrorResponse(error, "Bookings GET");
  }
}

export async function POST(request: Request): Promise<
  NextResponse<ApiResponse<BookingResponse>>
> {
  try {
    const body = await request.json();
    const validatedData = CreateBookingSchema.parse(body);

    const { trial_class_id, parent, student } = validatedData;

    const { data: trialClass, error: classError } = await supabase
      .from("trial_classes")
      .select("id, max_seats")
      .eq("id", trial_class_id)
      .single();

    if (classError || !trialClass) {
      throw new NotFoundError("Trial class", trial_class_id);
    }

    const parentInitials = `${parent.first_name[0]}${parent.last_name[0]}`;
    const parentId = generateSmartId(parentInitials, parent.phone);

    const { data: existingParent } = await supabase
      .from("parents")
      .select("id")
      .eq("email", parent.email)
      .single();

    let actualParentId = parentId;
    if (existingParent) {
      actualParentId = existingParent.id;
    } else {
      const { error: parentError } = await supabase.from("parents").insert({
        id: parentId,
        first_name: parent.first_name,
        last_name: parent.last_name,
        residential_id: parent.phone,
        email: parent.email,
      });

      if (parentError) {
        throw new DatabaseError("Failed to create parent record", parentError);
      }
    }

    const studentInitials = `${student.first_name[0]}${student.last_name[0]}`;
    const studentId = generateSmartId(studentInitials, student.grade.toString());

    const { data: existingStudent } = await supabase
      .from("students")
      .select("id")
      .eq("residential_id", student.grade.toString())
      .eq("parent_id", actualParentId)
      .single();

    let actualStudentId = studentId;
    if (existingStudent) {
      actualStudentId = existingStudent.id;
    } else {
      const { error: studentError } = await supabase.from("students").insert({
        id: studentId,
        parent_id: actualParentId,
        first_name: student.first_name,
        last_name: student.last_name,
        residential_id: student.grade.toString(),
      });

      if (studentError) {
        throw new DatabaseError("Failed to create student record", studentError);
      }
    }

    const { count: confirmedCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("trial_class_id", trial_class_id)
      .eq("status", BookingStatus.Confirmed);

    const seatsRemaining = trialClass.max_seats - (confirmedCount || 0);

    if (seatsRemaining <= 0) {
      throw new ConflictError("No seats available for this class");
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
      throw new DatabaseError("Failed to create booking", bookingError);
    }

    return NextResponse.json({
      success: true,
      data: {
        booking_id: booking.id,
        status: booking.status as BookingStatus,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Bookings POST");
  }
}
