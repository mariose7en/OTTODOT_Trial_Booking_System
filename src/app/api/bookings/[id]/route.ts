import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Booking, ApiResponse } from "@/types/booking";
import { z } from "zod";
import {
  NotFoundError,
  DatabaseError,
  createErrorResponse,
  rethrowIfDatabaseError,
} from "@/lib/errors";
import { bookingIdSchema } from "@/lib/validations/ids";

const BookingIdSchema = z.object({
  id: bookingIdSchema,
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;

    const validatedParams = BookingIdSchema.parse({ id });

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", validatedParams.id)
      .single();

    rethrowIfDatabaseError(error);
    if (error || !booking) {
      throw new NotFoundError("Booking", validatedParams.id);
    }

    return NextResponse.json({
      success: true,
      data: booking as Booking,
    });
  } catch (error) {
    return createErrorResponse(error, "Booking GET");
  }
}
