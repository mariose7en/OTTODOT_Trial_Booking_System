/**
 * PayMock in-process store (payment_mockup §5.1): intents, outcome scripts and
 * refunds — all deterministic (monotonic sequence ids, no `Math.random`, no
 * timers on the library path).
 */
import type {
  ChargeResult,
  CreateIntentInput,
  PaymentIntent,
  PaymentEventType,
  RefundResult,
} from "@/lib/payments/contracts";
import type { Delivery } from "@/lib/payments/mock/emit";
import type { MockOutcome } from "@/lib/payments/mock/outcomes";
import {
  outcomeToIntentStatus,
  outcomeToResult,
  parseOutcome,
} from "@/lib/payments/mock/outcomes";
import { mockClientSecret, mockIntentId, mockRefundId } from "@/lib/payments/mock/ids";

export interface MockIntent {
  id: string;
  booking_id: string | null;
  amount_cents: number;
  currency: string;
  status: PaymentIntent["status"];
  client_secret: string;
  metadata: Record<string, string>;
  created_seq: number;
}

export interface OutcomeScript {
  booking_id?: string;
  intent_id?: string;
  outcome: MockOutcome;
  /** Recorded for the UI; the library never sleeps (R9). */
  delay_ms: number;
  deliver_webhook: boolean;
  delivery: Delivery;
}

export interface MockRefund {
  id: string;
  intent_id: string;
  amount_cents: number;
  status: "succeeded";
  reason: string;
  created_seq: number;
}

export const DEFAULT_SCRIPT: OutcomeScript = {
  outcome: "success",
  delay_ms: 0,
  deliver_webhook: true,
  delivery: "once",
};

export interface PlanInput {
  outcome?: string;
  delay_ms?: number;
  deliver_webhook?: boolean;
  delivery?: string;
}

/** Store row → shared contract shape (R11 contract parity). */
export function toContractIntent(intent: MockIntent): PaymentIntent {
  return {
    id: intent.id,
    clientSecret: intent.client_secret,
    amount: intent.amount_cents,
    currency: intent.currency,
    status: intent.status,
    metadata: intent.metadata,
  };
}

export class MockPaymentStore {
  private intents = new Map<string, MockIntent>();
  private refunds = new Map<string, MockRefund>();
  private scripts = new Map<string, OutcomeScript>();
  private seq = 0;

  private nextSeq(): number {
    this.seq += 1;
    return this.seq;
  }

  createIntent(input: CreateIntentInput): MockIntent {
    const seq = this.nextSeq();
    const id = mockIntentId();
    const intent: MockIntent = {
      id,
      booking_id: input.metadata?.booking_id ?? null,
      amount_cents: input.amount,
      currency: (input.currency ?? "usd").toLowerCase(),
      status: "requires_payment_method",
      client_secret: mockClientSecret(id, seq),
      metadata: { ...(input.metadata ?? {}) },
      created_seq: seq,
    };
    this.intents.set(id, intent);
    return intent;
  }

  getIntent(id: string): MockIntent | undefined {
    return this.intents.get(id);
  }

  findIntentByBooking(bookingId: string): MockIntent | undefined {
    for (const intent of this.intents.values()) {
      if (intent.booking_id === bookingId) return intent;
    }
    return undefined;
  }

  /** Intent-keyed script wins over booking-keyed; otherwise the default. */
  scriptFor(intent?: Pick<MockIntent, "id" | "booking_id">): OutcomeScript {
    if (intent) {
      const byIntent = this.scripts.get(intent.id);
      if (byIntent) return byIntent;
      if (intent.booking_id) {
        const byBooking = this.scripts.get(intent.booking_id);
        if (byBooking) return byBooking;
      }
    }
    return DEFAULT_SCRIPT;
  }

  plan(key: string, input: PlanInput): OutcomeScript {
    const previous = this.scripts.get(key) ?? DEFAULT_SCRIPT;
    const script: OutcomeScript = {
      booking_id: key.startsWith("pi_") ? undefined : key,
      intent_id: key.startsWith("pi_") ? key : undefined,
      outcome: input.outcome ? parseOutcome(input.outcome) : previous.outcome,
      delay_ms:
        typeof input.delay_ms === "number" ? input.delay_ms : previous.delay_ms,
      deliver_webhook:
        typeof input.deliver_webhook === "boolean"
          ? input.deliver_webhook
          : previous.deliver_webhook,
      delivery: isDelivery(input.delivery) ? input.delivery : previous.delivery,
    };
    this.scripts.set(key, script);
    return script;
  }

  /** Advance an intent through the scripted outcome (no timers, R9). */
  charge(intentId: string): ChargeResult {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Unknown payment intent: ${intentId}`);
    }
    const script = this.scriptFor(intent);
    intent.status = outcomeToIntentStatus(script.outcome);
    return {
      intent: toContractIntent(intent),
      result: outcomeToResult(script.outcome),
    };
  }

  refund(
    intentId: string,
    input: { reason?: string; metadata?: Record<string, string> } = {}
  ): RefundResult {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Unknown payment intent: ${intentId}`);
    }
    if (intent.status !== "succeeded") {
      throw new Error(
        `Payment intent ${intentId} is not chargeable for refund (status: ${intent.status})`
      );
    }
    const seq = this.nextSeq();
    const refund: MockRefund = {
      id: mockRefundId(),
      intent_id: intent.id,
      amount_cents: intent.amount_cents,
      status: "succeeded",
      reason: input.reason ?? "requested_by_customer",
      created_seq: seq,
    };
    this.refunds.set(refund.id, refund);
    return {
      id: refund.id,
      paymentIntentId: refund.intent_id,
      status: refund.status,
      amount: refund.amount_cents,
    };
  }

  defaultEventTypes(intentId: string): PaymentEventType[] {
    const intent = this.intents.get(intentId);
    const script = this.scriptFor(intent);
    return script.outcome === "success"
      ? ["payment_intent.succeeded"]
      : ["payment_intent.payment_failed"];
  }

  reset(): void {
    this.intents.clear();
    this.refunds.clear();
    this.scripts.clear();
    this.seq = 0;
  }

  snapshot() {
    return {
      intents: [...this.intents.values()].map((intent) => ({ ...intent })),
      refunds: [...this.refunds.values()].map((refund) => ({ ...refund })),
      scripts: [...this.scripts.entries()].map(([key, script]) => ({
        key,
        ...script,
      })),
      sequence: this.seq,
    };
  }
}

function isDelivery(value: string | undefined): value is Delivery {
  if (!value) return false;
  return (
    value === "once" ||
    value === "duplicate" ||
    value === "reverse" ||
    /^parallel:\d+$/.test(value)
  );
}

export const mockStore = new MockPaymentStore();
