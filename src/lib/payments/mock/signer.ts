/**
 * Stripe-compatible signature signing/verification for PayMock (payment_mockup
 * D6): the same `stripe-signature` header format — `t=<unix>,v1=<hmac>` where
 * the HMAC-SHA256 key signs `${t}.${payload}` — so `webhook/route.ts` verifies
 * mock and real Stripe deliveries with one code path.
 */
import { createHmac, timingSafeEqual } from "crypto";

/** Used when STRIPE_WEBHOOK_SECRET is unset (dev default, D6). */
export const DEV_WEBHOOK_SECRET = "whsec_mock";

export function webhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET || DEV_WEBHOOK_SECRET;
}

export function computeSignature(
  payload: string,
  secret: string,
  timestamp: number
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
}

export function signPayload(
  payload: string,
  secret: string = webhookSecret(),
  timestamp: number = Math.floor(Date.now() / 1000)
): string {
  return `t=${timestamp},v1=${computeSignature(payload, secret, timestamp)}`;
}

export function verifySignature(
  payload: string,
  header: string,
  secret: string = webhookSecret(),
  toleranceSeconds = 300,
  now: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!header) return false;

  const parts = new Map<string, string[]>();
  for (const piece of header.split(",")) {
    const [rawKey, rawValue] = piece.split("=", 2);
    if (!rawKey || rawValue === undefined) continue;
    const key = rawKey.trim();
    const value = rawValue.trim();
    const list = parts.get(key) ?? [];
    list.push(value);
    parts.set(key, list);
  }

  const timestamp = Number(parts.get("t")?.[0]);
  const signatures = parts.get("v1") ?? [];
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now - timestamp) > toleranceSeconds) return false;

  const expected = computeSignature(payload, secret, timestamp);
  return signatures.some((candidate) => {
    const a = Buffer.from(candidate, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
