import { NextResponse } from "next/server";
import { NotFoundError, createErrorResponse } from "@/lib/errors";
import { isMockControlPlaneEnabled, getMockControls } from "@/lib/payments/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isMockControlPlaneEnabled()) {
      throw new NotFoundError("API route");
    }
    return NextResponse.json({
      success: true,
      data: getMockControls().state(),
    });
  } catch (error) {
    return createErrorResponse(error, "Mock state GET");
  }
}
