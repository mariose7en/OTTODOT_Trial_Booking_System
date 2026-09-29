/**
 * PayMock core (payment_mockup M2): deterministic ids, outcome scripting,
 * Stripe-format signatures, delivery modes, refund store, reset — plus the
 * B16 guarantee that `src/lib/stripe.ts` is import-safe without a key.
 * Runs with zero STRIPE_* env vars (M2 exit gate).
 */
import {
  mockControls,
  mockProvider,
} from "@/lib/payments/mock";
import {
  buildEmitRequests,
  expandDelivery,
} from "@/lib/payments/mock/emit";
import {
  DEV_WEBHOOK_SECRET,
  computeSignature,
  signPayload,
  verifySignature,
} from "@/lib/payments/mock/signer";
import { parseOutcome } from "@/lib/payments/mock/outcomes";
import {
  getMockControls,
  getPaymentProvider,
  isMockControlPlaneEnabled,
  resolveProviderMode,
} from "@/lib/payments/provider";
import { resetIdSequences } from "@/lib/payments/id";

const INTENT = {
  amount: 2000,
  metadata: { booking_id: "BOOKING001-20261001", trial_class_id: "TRC-001" },
};

const savedEnv: Record<string, string | undefined> = {};
const ENV_KEYS = ["PAYMENT_PROVIDER", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  delete process.env.PAYMENT_PROVIDER;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  mockControls.reset();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("id determinism (R6)", () => {
  test("1000 sequential createIntent calls mint unique pi_mock ids", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 1000; i += 1) {
      const intent = await mockProvider.createIntent(INTENT);
      ids.push(intent.id);
      expect(intent.id).toMatch(/^pi_mock_\d{6}_\d{8}$/);
      expect(intent.clientSecret).toBe(`${intent.id}_secret_${i + 1}`);
    }
    expect(new Set(ids).size).toBe(1000);
  });

  test("100 parallel createIntent calls never collide", async () => {
    const intents = await Promise.all(
      Array.from({ length: 100 }, () => mockProvider.createIntent(INTENT))
    );
    expect(new Set(intents.map((i) => i.id)).size).toBe(100);
  });
});

describe("outcome scripting (R2)", () => {
  test("script keyed by booking drives the charge result", async () => {
    const intent = await mockProvider.createIntent(INTENT);
    mockControls.plan(INTENT.metadata.booking_id, { outcome: "failure" });

    const charge = mockControls.charge(intent.id);
    expect(charge.result).toBe("FAILED");
    expect(charge.intent.status).toBe("canceled");
  });

  test("script keyed by intent wins over the booking script", async () => {
    const intent = await mockProvider.createIntent(INTENT);
    mockControls.plan(INTENT.metadata.booking_id, { outcome: "failure" });
    mockControls.plan(intent.id, { outcome: "success" });

    expect(mockControls.charge(intent.id).result).toBe("SUCCESS");
  });

  test("declined:<code> is a failure and maps to a payment_failed event", async () => {
    const intent = await mockProvider.createIntent(INTENT);
    mockControls.plan(intent.id, { outcome: "declined:card_declined" });

    const charge = mockControls.charge(intent.id);
    expect(charge.result).toBe("FAILED");
    expect(charge.intent.status).toBe("canceled");

    const emit = buildEmitRequests({ intent_id: intent.id });
    expect(emit.eventTypes).toEqual(["payment_intent.payment_failed"]);
    expect(parseOutcome("declined:card_declined")).toBe("declined:card_declined");
    expect(() => parseOutcome("chargeback")).toThrow(/Unsupported payment outcome/);
  });

  test("no script → success (the demo default)", async () => {
    const intent = await mockProvider.createIntent(INTENT);
    expect(mockControls.charge(intent.id).result).toBe("SUCCESS");
  });

  test("delay_ms is recorded for the UI but the library never sleeps (R9)", async () => {
    const intent = await mockProvider.createIntent(INTENT);
    mockControls.plan(intent.id, { outcome: "success", delay_ms: 1500 });

    const timerSpy = jest.spyOn(global, "setTimeout");
    const charge = mockControls.charge(intent.id);
    expect(timerSpy).not.toHaveBeenCalled();
    timerSpy.mockRestore();

    expect(charge.result).toBe("SUCCESS");
    const script = mockControls.state().scripts.find((s) => s.key === intent.id);
    expect(script?.delay_ms).toBe(1500);
  });
});

describe("signatures (R3/D6)", () => {
  test("a signed payload verifies, a tampered one does not", () => {
    const payload = JSON.stringify({ type: "payment_intent.succeeded" });
    const header = signPayload(payload, DEV_WEBHOOK_SECRET, 1_760_000_000);

    expect(
      verifySignature(payload, header, DEV_WEBHOOK_SECRET, 300, 1_760_000_000)
    ).toBe(true);
    expect(
      verifySignature(
        `${payload} `,
        header,
        DEV_WEBHOOK_SECRET,
        300,
        1_760_000_000
      )
    ).toBe(false);
    expect(
      verifySignature(payload, header, "whsec_other", 300, 1_760_000_000)
    ).toBe(false);
  });

  test("missing or malformed headers are rejected", () => {
    const payload = "{}";
    expect(verifySignature(payload, "", DEV_WEBHOOK_SECRET)).toBe(false);
    expect(verifySignature(payload, "v1=abc", DEV_WEBHOOK_SECRET)).toBe(false);
    expect(verifySignature(payload, "t=abc,v1=abc", DEV_WEBHOOK_SECRET)).toBe(
      false
    );
  });

  test("a stale timestamp outside the tolerance is rejected", () => {
    const payload = "{}";
    const header = signPayload(payload, DEV_WEBHOOK_SECRET, 1_000);
    expect(verifySignature(payload, header, DEV_WEBHOOK_SECRET, 300, 10_000)).toBe(
      false
    );
  });

  test("the header format matches Stripe's t=…,v1=… shape", () => {
    const header = signPayload("{}", DEV_WEBHOOK_SECRET, 1_760_000_000);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(
      computeSignature("{}", DEV_WEBHOOK_SECRET, 1_760_000_000)
    ).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("delivery modes (R4)", () => {
  test("once / duplicate / reverse / parallel:N expand as specified", () => {
    const events = ["payment_intent.succeeded", "payment_intent.payment_failed"] as const;
    expect(expandDelivery([...events], "once")).toHaveLength(2);
    expect(expandDelivery([...events], "duplicate")).toHaveLength(4);
    expect(expandDelivery([...events], "reverse")).toEqual([
      "payment_intent.payment_failed",
      "payment_intent.succeeded",
    ]);
    expect(expandDelivery([...events], "parallel:3")).toHaveLength(6);
  });

  test("emit builds signed requests for the scripted outcome", async () => {
    const intent = await mockProvider.createIntent(INTENT);
    mockControls.plan(intent.id, { outcome: "failure" });

    const emit = buildEmitRequests({ intent_id: intent.id, timestamp: 1_760_000_000 });
    expect(emit.eventTypes).toEqual(["payment_intent.payment_failed"]);
    expect(emit.requests).toHaveLength(1);

    const request = emit.requests[0];
    expect(request.url).toBe("http://localhost/api/payments/webhook");
    const body = await request.text();
    const header = request.headers.get("stripe-signature")!;
    expect(verifySignature(body, header, DEV_WEBHOOK_SECRET, 300, 1_760_000_000)).toBe(
      true
    );
    const event = JSON.parse(body);
    expect(event.type).toBe("payment_intent.payment_failed");
    expect(event.data.object.metadata.booking_id).toBe(INTENT.metadata.booking_id);
  });

  test("duplicate delivery reuses one event id (idempotency input, I8)", async () => {
    const intent = await mockProvider.createIntent(INTENT);
    const emit = buildEmitRequests({
      intent_id: intent.id,
      delivery: "duplicate",
      timestamp: 1_760_000_000,
    });
    const bodies = await Promise.all(emit.requests.map((r) => r.text()));
    const ids = bodies.map((b) => JSON.parse(b).id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(1);
  });

  test("emitting for an unknown booking throws a clear error", () => {
    expect(() => buildEmitRequests({ booking_id: "NOPE-001" })).toThrow(
      /No mock intent found/
    );
  });
});

describe("refunds & reset (R5/R10)", () => {
  test("refunding a charged intent records a re_mock refund", async () => {
    const intent = await mockProvider.createIntent(INTENT);
    mockControls.charge(intent.id);

    const refund = await mockProvider.refund({
      paymentIntentId: intent.id,
      reason: "requested_by_customer",
      metadata: { booking_id: INTENT.metadata.booking_id },
    });

    expect(refund.id).toMatch(/^re_mock_\d{6}_\d{8}$/);
    expect(refund.paymentIntentId).toBe(intent.id);
    expect(refund.amount).toBe(2000);

    const state = mockControls.state();
    expect(state.refunds).toHaveLength(1);
    expect(state.refunds[0].id).toBe(refund.id);
  });

  test("refunding an uncharged intent is refused", async () => {
    const intent = await mockProvider.createIntent(INTENT);
    await expect(
      mockProvider.refund({ paymentIntentId: intent.id })
    ).rejects.toThrow(/not chargeable for refund/);
  });

  test("reset clears intents, scripts, refunds and the id sequence", async () => {
    const intent = await mockProvider.createIntent(INTENT);
    mockControls.plan(intent.id, { outcome: "failure" });
    mockControls.charge(intent.id);
    expect(mockControls.state().intents).toHaveLength(1);

    mockControls.reset();
    expect(mockControls.state().intents).toHaveLength(0);
    expect(mockControls.state().scripts).toHaveLength(0);
    expect(mockControls.state().refunds).toHaveLength(0);
    expect(mockControls.state().sequence).toBe(0);

    resetIdSequences();
    const fresh = await mockProvider.createIntent(INTENT);
    expect(fresh.id).toMatch(/^pi_mock_000001_\d{8}$/);
  });
});

describe("provider resolution (D5/D10)", () => {
  test("explicit PAYMENT_PROVIDER wins", () => {
    process.env.PAYMENT_PROVIDER = "stripe";
    expect(resolveProviderMode()).toBe("stripe");
    expect(getPaymentProvider().name).toBe("stripe");
    expect(isMockControlPlaneEnabled()).toBe(false);
    expect(() => getMockControls()).toThrow(/control plane is disabled/);

    process.env.PAYMENT_PROVIDER = "mock";
    expect(resolveProviderMode()).toBe("mock");
    expect(getPaymentProvider().name).toBe("mock");
    expect(isMockControlPlaneEnabled()).toBe(true);
    expect(getMockControls()).toBe(mockControls);
  });

  test("no key outside tests resolves to mock", () => {
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.STRIPE_SECRET_KEY;
    expect(resolveProviderMode()).toBe("mock");
    expect(getPaymentProvider().name).toBe("mock");
  });
});

describe("B16: the stripe module is import-safe", () => {
  test("importing @/lib/stripe does not throw without STRIPE_SECRET_KEY", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => jest.resetModules() && require("@/lib/stripe")).not.toThrow();
  });

  test("the client is only required on first property access", () => {
    delete process.env.STRIPE_SECRET_KEY;
    jest.resetModules();
    const mod = require("@/lib/stripe") as { stripe: Record<string, unknown> };
    expect(() => mod.stripe.paymentIntents).toThrow(/STRIPE_SECRET_KEY is not set/);
  });
});
