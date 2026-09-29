/**
 * Builds signed Stripe-shaped webhook deliveries for PayMock (payment_mockup
 * R3/R4): same header format, same event JSON, delivery modes `once`,
 * `duplicate`, `reverse` and `parallel:N`.
 */
import type {
  PaymentEvent,
  PaymentEventType,
} from "@/lib/payments/contracts";
import type { MockIntent } from "@/lib/payments/mock/store";
import { mockStore, toContractIntent } from "@/lib/payments/mock/store";
import { signPayload, webhookSecret } from "@/lib/payments/mock/signer";

export type Delivery = "once" | "duplicate" | "reverse" | `parallel:${number}`;

export const WEBHOOK_PATH = "/api/payments/webhook";
export const WEBHOOK_URL = `http://localhost${WEBHOOK_PATH}`;

export interface EmitInput {
  intent_id?: string;
  booking_id?: string;
  /** Defaults to the scripted outcome's event. */
  events?: PaymentEventType[];
  delivery?: Delivery;
  /** Signature timestamp override (determinism in tests). */
  timestamp?: number;
}

export interface EmitResult {
  requests: Request[];
  eventTypes: PaymentEventType[];
  delivery: Delivery;
  intent_id: string;
}

function resolveIntent(input: EmitInput): MockIntent {
  const intent = input.intent_id
    ? mockStore.getIntent(input.intent_id)
    : input.booking_id
      ? mockStore.findIntentByBooking(input.booking_id)
      : undefined;
  if (!intent) {
    throw new Error(
      `No mock intent found for ${input.intent_id ?? input.booking_id ?? "(nothing given)"}`
    );
  }
  return intent;
}

export function buildEvent(
  intent: MockIntent,
  type: PaymentEventType,
  timestamp: number
): PaymentEvent {
  const label = type === "payment_intent.succeeded" ? "succeeded" : "failed";
  return {
    id: `evt_mock_${intent.created_seq}_${label}_${timestamp}`,
    type,
    created: timestamp,
    data: { object: toContractIntent(intent) },
  };
}

export function buildWebhookRequest(
  event: PaymentEvent,
  options: { timestamp?: number; secret?: string } = {}
): Request {
  const payload = JSON.stringify(event);
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = signPayload(payload, options.secret ?? webhookSecret(), timestamp);
  return new Request(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": signature },
    body: payload,
  });
}

/** Expand a delivery mode into the concrete list of events to send. */
export function expandDelivery(
  events: PaymentEventType[],
  delivery: Delivery
): PaymentEventType[] {
  if (delivery === "once") return events;
  if (delivery === "reverse") return [...events].reverse();
  if (delivery === "duplicate") return events.flatMap((type) => [type, type]);
  const parallel = Number(delivery.split(":")[1]);
  if (!Number.isInteger(parallel) || parallel < 1) {
    throw new Error(`Invalid delivery mode: ${delivery}`);
  }
  return events.flatMap((type) => Array.from({ length: parallel }, () => type));
}

export function buildEmitRequests(input: EmitInput): EmitResult {
  const intent = resolveIntent(input);
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const delivery: Delivery = input.delivery ?? "once";
  const baseEvents =
    input.events && input.events.length > 0
      ? input.events
      : mockStore.defaultEventTypes(intent.id);
  const expanded = expandDelivery(baseEvents, delivery);
  const requests = expanded.map((type) =>
    buildWebhookRequest(buildEvent(intent, type, timestamp), { timestamp })
  );
  return {
    requests,
    eventTypes: expanded,
    delivery,
    intent_id: intent.id,
  };
}
