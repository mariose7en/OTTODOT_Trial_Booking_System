import Stripe from "stripe";

/**
 * Lazy Stripe client (fix_plan B16).
 *
 * The module used to `throw` at import time when STRIPE_SECRET_KEY was unset,
 * which made every route that touched it unimportable in CI and made the mock
 * provider impossible. The client is now created on first use; `stripe` stays
 * a value-shaped export (a proxy) so existing `stripe.paymentIntents.create`
 * call sites and the `jest.mock("@/lib/stripe")` seams in the test suites keep
 * working unchanged.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!cached) {
    cached = new Stripe(key, {
      apiVersion: "2026-08-26.dahlia",
      typescript: true,
    });
  }
  return cached;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const client = getStripe();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
