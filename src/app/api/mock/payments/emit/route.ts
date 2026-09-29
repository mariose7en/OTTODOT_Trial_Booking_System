import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BadRequestError,
  NotFoundError,
  createErrorResponse,
} from "@/lib/errors";
import { isMockControlPlaneEnabled, getMockControls } from "@/lib/payments/provider";
import { POST as webhookPOST } from "@/app/api/payments/webhook/route";

export const dynamic = "force-dynamic";

const EmitSchema = z.object({
  intent_id: z.string().min(1).optional(),
  booking_id: z.string().min(1).optional(),
  events: z
    .array(
      z.enum(["payment_intent.succeeded", "payment_intent.payment_failed"])
    )
    .min(1)
    .optional(),
  delivery: z
    .string()
    .refine(
      (value) =>
        value === "once" ||
        value === "duplicate" ||
        value === "reverse" ||
        /^parallel:\d+$/.test(value),
      { message: "delivery must be once | duplicate | reverse | parallel:N" }
    )
    .optional(),
  timestamp: z.number().int().optional(),
});

export async function POST(request: Request) {
  try {
    if (!isMockControlPlaneEnabled()) {
      throw new NotFoundError("API route");
    }
    const parsed = EmitSchema.parse(await request.json());
    if (!parsed.intent_id && !parsed.booking_id) {
      throw new BadRequestError("intent_id or booking_id is required");
    }

    const emit = (() => {
      try {
        return getMockControls().emit({
          intent_id: parsed.intent_id,
          booking_id: parsed.booking_id,
          events: parsed.events,
          delivery: parsed.delivery as never,
          timestamp: parsed.timestamp,
        });
      } catch (error) {
        // R8: a client mistake (unknown intent/booking) answers with the same
        // object envelope as every other payment route, not a bare 500.
        throw new BadRequestError(
          error instanceof Error ? error.message : "Unknown payment intent"
        );
      }
    })();

    // Deliveries go out concurrently (`parallel:N` really is a burst — that is
    // what the race scenarios RC-010/011/023 need); the mode itself has
    // already expanded the event list (once/duplicate/reverse/parallel:N).
    const responses = await Promise.all(
      emit.requests.map((r) => webhookPOST(r))
    );

    const statuses = responses.map((r) => r.status);

    return NextResponse.json({
      success: true,
      data: {
        intent_id: emit.intent_id,
        event_types: emit.eventTypes,
        delivery: emit.delivery,
        delivered: responses.length,
        statuses,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Mock emit POST");
  }
}
