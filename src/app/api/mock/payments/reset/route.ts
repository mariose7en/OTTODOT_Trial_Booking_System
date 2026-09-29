import { NextResponse } from "next/server";
import { NotFoundError, createErrorResponse } from "@/lib/errors";
import { isMockControlPlaneEnabled, getMockControls } from "@/lib/payments/provider";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (!isMockControlPlaneEnabled()) {
      throw new NotFoundError("API route");
    }
    getMockControls().reset();
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    return createErrorResponse(error, "Mock reset POST");
  }
}
