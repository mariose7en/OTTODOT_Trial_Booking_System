/**
 * Single source of truth for what a trial class costs (payment_mockup D4).
 * The charge amount in cents and every display label derive from here.
 *
 * NOTE (D4, decided 2026-09-29 — "keep both for now"): the booking page still
 * renders the `FREE` label for its mock-payment copy, so the fix_plan price row
 * stays *half*-fixed until F1 wires the UI to `TRIAL_CLASS_PRICE_LABEL`.
 */
export const TRIAL_CLASS_PRICE_CENTS = 2000;

export const TRIAL_CLASS_PRICE_LABEL = "FREE";

export function formatPrice(cents: number, currency = "usd"): string {
  const symbol = currency === "usd" || currency === "USD" ? "$" : "";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export const TRIAL_CLASS_PRICE_DISPLAY = formatPrice(TRIAL_CLASS_PRICE_CENTS);
