import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BadRequestError,
  NotFoundError,
  createErrorResponse,
} from "@/lib/errors";
import { isMockControlPlaneEnabled } from "@/lib/payments/provider";
import { getMockControls } from "@/lib/payments/provider";
import { parseOutcome } from "@/lib/payments/mock/outcomes";

export const dynamic = "force-dynamic";

const PlanSchema = z.object({
  intent_id: z.string().min(1).optional(),
  booking_id: z.string().min(1).optional(),
  outcome: z
    .string()
    .refine(
      (value) => {
        try {
          parseOutcome(value);
          return true;
        } catch {
          return false;
        }
      },
      { message: "outcome must be success | failure | declined:<code>" }
    ),
  delay_ms: z.number().int().min(0).optional(),
  deliver_webhook: z.boolean().optional(),
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
});

export async function POST(request: Request) {
  try {
    if (!isMockControlPlaneEnabled()) {
      throw new NotFoundError("API route");
    }
    const parsed = PlanSchema.parse(await request.json());
    const key = parsed.intent_id ?? parsed.booking_id;
    if (!key) {
      throw new BadRequestError("intent_id or booking_id is required");
    }

    const script = getMockControls().plan(key, {
      outcome: parsed.outcome,
      delay_ms: parsed.delay_ms,
      deliver_webhook: parsed.deliver_webhook,
      delivery: parsed.delivery,
    });

    return NextResponse.json({ success: true, data: { key, ...script } });
  } catch (error) {
    return createErrorResponse(error, "Mock plan POST");
  }
}
