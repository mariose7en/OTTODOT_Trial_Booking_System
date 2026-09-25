import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { TrialClassWithSeats, ApiResponse } from "@/types/booking";

export async function GET(
  request: Request
): Promise<NextResponse<ApiResponse<TrialClassWithSeats[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const availableOnly = searchParams.get("available") === "true";

    const { data: trialClasses, error: classError } = await supabase
      .from("trial_classes")
      .select("*")
      .order("start_time", { ascending: true });

    if (classError) {
      console.error("Error fetching trial classes:", classError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch trial classes" },
        { status: 500 }
      );
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

    const filtered = availableOnly
      ? classesWithSeats.filter((c) => c.seats_remaining > 0)
      : classesWithSeats;

    return NextResponse.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
