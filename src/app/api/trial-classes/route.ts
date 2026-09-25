import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { TrialClassWithSeats, ApiResponse } from "@/types/booking";
import { TrialClassQuerySchema } from "@/lib/validations/booking";
import { DatabaseError, createErrorResponse } from "@/lib/errors";

export async function GET(
  request: Request
): Promise<NextResponse<ApiResponse<TrialClassWithSeats[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());

    const validatedQuery = TrialClassQuerySchema.parse(query);

    const { data: trialClasses, error: classError } = await supabase
      .from("trial_classes")
      .select("*")
      .order("start_time", { ascending: true });

    if (classError) {
      throw new DatabaseError("Failed to fetch trial classes", classError);
    }

    const classesWithSeats: TrialClassWithSeats[] = await Promise.all(
      (trialClasses || []).map(async (cls) => {
        const { count: confirmedCount } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("trial_class_id", cls.id)
          .eq("status", "CONFIRMED");

        return {
          ...cls,
          confirmed_count: confirmedCount || 0,
          seats_remaining: cls.max_seats - (confirmedCount || 0),
        };
      })
    );

    const filtered = validatedQuery.available
      ? classesWithSeats.filter((c) => c.seats_remaining > 0)
      : classesWithSeats;

    return NextResponse.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    return createErrorResponse(error, "Trial Classes GET");
  }
}
