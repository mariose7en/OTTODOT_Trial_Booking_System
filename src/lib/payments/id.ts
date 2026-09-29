/**
 * Deterministic id factories for the payment layer (payment_mockup R6, D-B08).
 *
 * Monotonic per-day sequence + date stamp, no `Math.random`, so N concurrent
 * creates in one process can never collide and tests can assert exact ids.
 * Cross-process collisions remain the DB sequence's job (fix_plan F7).
 */

const counters = new Map<string, number>();

export function nextSequence(key: string): number {
  const value = (counters.get(key) ?? 0) + 1;
  counters.set(key, value);
  return value;
}

export function resetIdSequences(): void {
  counters.clear();
}

function dayStamp(at: Date): string {
  return at.toISOString().slice(0, 10).replace(/-/g, "");
}

/** ATTEMPT001-20260929 — one per day, zero-padded, monotonic. */
export function generateAttemptId(at: Date = new Date()): string {
  const day = dayStamp(at);
  const seq = String(nextSequence(`attempt:${day}`)).padStart(3, "0");
  return `ATTEMPT${seq}-${day}`;
}

/** Legacy transaction id — only used when no payment intent is known (D9). */
export function generateTxnId(at: Date = new Date()): string {
  const day = dayStamp(at);
  const seq = String(nextSequence(`txn:${day}`)).padStart(6, "0");
  return `TXN-${day}-${seq}`;
}

/**
 * Payment intent id. Default (`pi_`) mimics Stripe; PayMock passes
 * `prefix: "pi_mock"` → `pi_mock_000001_20260929` (§5.1), refunds `re_mock_…`.
 */
export function generateIntentId(at: Date = new Date(), prefix = "pi"): string {
  const day = dayStamp(at);
  const seq = String(nextSequence(`intent:${prefix}:${day}`)).padStart(6, "0");
  return prefix === "pi" ? `pi_${day}${seq}` : `${prefix}_${seq}_${day}`;
}

export function generateRefundId(at: Date = new Date(), prefix = "re"): string {
  const day = dayStamp(at);
  const seq = String(nextSequence(`refund:${prefix}:${day}`)).padStart(6, "0");
  return prefix === "re" ? `re_${day}${seq}` : `${prefix}_${seq}_${day}`;
}
