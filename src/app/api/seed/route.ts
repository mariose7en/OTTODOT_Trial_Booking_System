import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiResponse } from "@/types/booking";
import {
  SEED_PARENTS,
  SEED_STUDENTS,
  SEED_TRIAL_CLASSES,
  SEED_BOOKINGS,
  SEED_PAYMENT_ATTEMPTS,
} from "@/lib/seed-data";

export async function POST(): Promise<NextResponse<ApiResponse<{ message: string }>>> {
  try {
    const { error: parentsError } = await supabase
      .from("parents")
      .upsert(SEED_PARENTS, { onConflict: "id" });

    if (parentsError) {
      console.error("Error seeding parents:", parentsError);
      return NextResponse.json(
        { success: false, error: `Failed to seed parents: ${parentsError.message}` },
        { status: 500 }
      );
    }

    const { error: studentsError } = await supabase
      .from("students")
      .upsert(SEED_STUDENTS, { onConflict: "id" });

    if (studentsError) {
      console.error("Error seeding students:", studentsError);
      return NextResponse.json(
        { success: false, error: `Failed to seed students: ${studentsError.message}` },
        { status: 500 }
      );
    }

    const { error: classesError } = await supabase
      .from("trial_classes")
      .upsert(SEED_TRIAL_CLASSES, { onConflict: "id" });

    if (classesError) {
      console.error("Error seeding trial classes:", classesError);
      return NextResponse.json(
        { success: false, error: `Failed to seed trial classes: ${classesError.message}` },
        { status: 500 }
      );
    }

    const { error: bookingsError } = await supabase
      .from("bookings")
      .upsert(SEED_BOOKINGS, { onConflict: "id" });

    if (bookingsError) {
      console.error("Error seeding bookings:", bookingsError);
      return NextResponse.json(
        { success: false, error: `Failed to seed bookings: ${bookingsError.message}` },
        { status: 500 }
      );
    }

    const { error: paymentsError } = await supabase
      .from("payment_attempts")
      .upsert(SEED_PAYMENT_ATTEMPTS, { onConflict: "id" });

    if (paymentsError) {
      console.error("Error seeding payment attempts:", paymentsError);
      return NextResponse.json(
        { success: false, error: `Failed to seed payment attempts: ${paymentsError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: "Seed data initialized successfully" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
