/**
 * Payment provider resolution (payment_mockup §6 D5).
 *
 *   1. `PAYMENT_PROVIDER=mock|stripe` wins when set.
 *   2. Otherwise `stripe` only when STRIPE_SECRET_KEY is configured outside
 *      tests (so jest never depends on a live key).
 *   3. Otherwise `mock`.
 *
 * `src/lib/stripe.ts` is lazy, so reaching this module can never throw (B16).
 */
import type { PaymentProvider } from "@/lib/payments/contracts";
import type { MockControls } from "@/lib/payments/mock";
import { mockControls, mockProvider } from "@/lib/payments/mock";
import { stripeProvider } from "@/lib/payments/stripeAdapter";

export type ProviderMode = "mock" | "stripe";

export function resolveProviderMode(): ProviderMode {
  const explicit = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (explicit === "mock" || explicit === "stripe") return explicit;
  if (process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV !== "test") {
    return "stripe";
  }
  return "mock";
}

export function getPaymentProvider(): PaymentProvider {
  return resolveProviderMode() === "stripe" ? stripeProvider : mockProvider;
}

/** The dev/test control plane is only reachable in mock mode (D10). */
export function isMockControlPlaneEnabled(): boolean {
  return resolveProviderMode() === "mock" && process.env.NODE_ENV !== "production";
}

export function getMockControls(): MockControls {
  if (!isMockControlPlaneEnabled()) {
    throw new Error(
      `PayMock control plane is disabled (PAYMENT_PROVIDER=${resolveProviderMode()}, NODE_ENV=${process.env.NODE_ENV})`
    );
  }
  return mockControls;
}
