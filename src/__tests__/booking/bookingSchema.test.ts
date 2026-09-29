/**
 * L1 — booking schemas, generators and error mapping.
 * Cases: BK-UT-001 … BK-UT-012, BK-UT-016
 *
 * Convention ([BUG-ASSERT], plan §3): the first assertion pins today's behaviour so
 * the suite stays green while the defect is open; `test.todo` carries the Target
 * assertion to be enabled when the fix lands.
 *
 * BK-UT-013/014/015 are executed in `bookingApi.test.ts` because
 * `generateBookingId` / `generateSmartId` are module-private — see plan §10.5 D-v1.
 */
import { ZodError } from "zod";
import {
  CreateBookingSchema,
  ConfirmPaymentSchema,
  BookingQuerySchema,
  TrialClassQuerySchema,
} from "@/lib/validations/booking";
import { BookingStatus, PaymentAttemptStatus } from "@/types/booking";
import {
  ConflictError,
  DatabaseError,
  NotFoundError,
  ValidationError,
  createErrorResponse,
} from "@/lib/errors";
import { validCreateBooking, flatUiCreateBooking } from "../helpers/bookingFixtures";

function parseOk(schema: { parse: (v: unknown) => unknown }, value: unknown) {
  return schema.parse(value);
}

function parseFail(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) {
  return schema.safeParse(value);
}

describe("BK-UT booking schema (L1)", () => {
  test("BK-UT-001: CreateBookingSchema accepts a nested payload with a format-valid class id", () => {
    const parsed = parseOk(CreateBookingSchema, validCreateBooking()) as any;
    expect(parsed.trial_class_id).toBe("MT-M-20261001T1000-4");
    expect(parsed.parent.phone).toBe("+65 9123 4567");
    expect(parsed.student.grade).toBe(4);
  });

  test("BK-UT-002: [BUG-ASSERT B1] the flat payload the UI sends is rejected (missing parent/student objects)", () => {
    const result = parseFail(CreateBookingSchema, flatUiCreateBooking());
    expect(result.success).toBe(false);
    const issues = (result as any).error.issues as ZodError["issues"];
    const paths = issues.map((i) => i.path.join("."));
    expect(paths).toContain("parent");
    expect(paths).toContain("student");
  });

  test.todo(
    "BK-UT-002 Target [FIX B1]: CreateBookingSchema accepts the flat CreateBookingRequest shape the UI sends (or the client is migrated to the nested shape)"
  );

  test("BK-UT-003: [BUG-ASSERT B2] payload without parent.phone / student.grade is rejected — the form cannot satisfy the schema", () => {
    const payload: any = validCreateBooking();
    delete payload.parent.phone;
    delete payload.student.grade;
    const result = parseFail(CreateBookingSchema, payload);
    expect(result.success).toBe(false);
    const paths = ((result as any).error.issues as ZodError["issues"]).map((i) =>
      i.path.join(".")
    );
    expect(paths).toContain("parent.phone");
    expect(paths).toContain("student.grade");
  });

  test.todo(
    "BK-UT-003 Target [FIX B2]: the booking form collects phone + grade (or the schema makes them optional)"
  );

  test("BK-UT-004: [BUG-ASSERT B5] a seed id (TRC-001) is rejected by the class-id regex", () => {
    const result = parseFail(
      CreateBookingSchema,
      validCreateBooking({ trial_class_id: "TRC-001" })
    );
    expect(result.success).toBe(false);
    const issue = ((result as any).error.issues as ZodError["issues"])[0];
    expect(issue.path).toEqual(["trial_class_id"]);
    expect(issue.message).toMatch(/Invalid trial class ID format/);
  });

  test.todo(
    "BK-UT-004 Target [FIX B5]: trial_class_id accepts every id produced by artifacts/seed.sql (TRC-001 … TRC-004)"
  );

  test("BK-UT-005: names are upper-cased and trimmed, email lower-cased and trimmed", () => {
    const parsed = parseOk(CreateBookingSchema, validCreateBooking()) as any;
    expect(parsed.parent.first_name).toBe("ALICE");
    expect(parsed.parent.last_name).toBe("LEE");
    expect(parsed.parent.email).toBe("alice@example.com");
    expect(parsed.student.first_name).toBe("CHARLIE");
  });

  test("BK-UT-006: phone accepts spaces/dashes/leading +, rejects letters and short values", () => {
    for (const phone of ["0912 345-678", "+65 9123 4567", "91234567"]) {
      const result = parseFail(
        CreateBookingSchema,
        validCreateBooking({ parent: { ...validCreateBooking().parent, phone } })
      );
      expect(result.success).toBe(true);
    }
    for (const phone of ["abc", "123", "+"]) {
      const result = parseFail(
        CreateBookingSchema,
        validCreateBooking({ parent: { ...validCreateBooking().parent, phone } })
      );
      expect(result.success).toBe(false);
    }
  });

  test("BK-UT-007: grade is an integer between 1 and 6", () => {
    for (const grade of [1, 6]) {
      expect(
        parseFail(
          CreateBookingSchema,
          validCreateBooking({ student: { ...validCreateBooking().student, grade } })
        ).success
      ).toBe(true);
    }
    for (const grade of [0, 7, 3.5]) {
      expect(
        parseFail(
          CreateBookingSchema,
          validCreateBooking({ student: { ...validCreateBooking().student, grade } })
        ).success
      ).toBe(false);
    }
  });

  test("BK-UT-008: ConfirmPaymentSchema accepts the values the UI and RPC both use, normalised to one casing", () => {
    const uuid = "0b0e4a9e-4f6a-4d1a-8f4f-2a4b7c9d1e23";
    expect(
      ConfirmPaymentSchema.parse({ booking_id: uuid, payment_result: "SUCCESS" })
        .payment_result
    ).toBe("SUCCESS");
    expect(
      ConfirmPaymentSchema.parse({ booking_id: uuid, payment_result: "FAILED" })
        .payment_result
    ).toBe("FAILED");
    // one-release lowercase tolerance (D1) — normalised on the way out
    expect(
      ConfirmPaymentSchema.parse({ booking_id: uuid, payment_result: "success" })
        .payment_result
    ).toBe("SUCCESS");
    expect(
      ConfirmPaymentSchema.parse({ booking_id: uuid, payment_result: "failure" })
        .payment_result
    ).toBe("FAILED");
    expect(
      parseFail(ConfirmPaymentSchema, {
        booking_id: uuid,
        payment_result: "paid",
      }).success
    ).toBe(false);
  });

  test("BK-UT-009: ConfirmPaymentSchema accepts the booking ids the app actually mints", () => {
    for (const booking_id of [
      "BOOKING001-20260928", // generateBookingId()
      "BKG-001", // artifacts/seed.sql
      "0b0e4a9e-4f6a-4d1a-8f4f-2a4b7c9d1e23", // legacy uuid row
    ]) {
      expect(
        ConfirmPaymentSchema.parse({ booking_id, payment_result: "SUCCESS" }).booking_id
      ).toBe(booking_id);
    }

    const result = parseFail(ConfirmPaymentSchema, {
      booking_id: "not-a-booking-id",
      payment_result: "SUCCESS",
    });
    expect(result.success).toBe(false);
    expect(((result as any).error.issues as ZodError["issues"])[0].message).toMatch(
      /Invalid booking ID format/
    );
  });

  test("BK-UT-010: [BUG-ASSERT B5/§6] query schema rejects seed class ids but accepts the un-storable status COMPLETED", () => {
    expect(
      parseFail(BookingQuerySchema, { trial_class_id: "TRC-001" }).success
    ).toBe(false);
    expect(
      parseOk(BookingQuerySchema, { trial_class_id: "MT-M-20261001T1000-4" })
    ).toEqual({ trial_class_id: "MT-M-20261001T1000-4" });
    expect(parseOk(BookingQuerySchema, { status: "COMPLETED" })).toEqual({
      status: "COMPLETED",
    });
    expect(parseOk(BookingQuerySchema, { status: "REFUNDED" })).toEqual({
      status: "REFUNDED",
    });
  });

  test.todo(
    "BK-UT-010 Target [FIX B5/§6]: trial_class_id accepts seed ids; status enum matches the DB CHECK set exactly (COMPLETED removed)"
  );

  test("BK-UT-011: [BUG-ASSERT §6] BookingStatus enum contains RPC return codes and omits REFUNDED", () => {
    const values = Object.values(BookingStatus) as string[];
    expect(values).toEqual(
      expect.arrayContaining([
        "PENDING_PAYMENT",
        "CONFIRMED",
        "PAYMENT_FAILED",
        "CANCELLED",
        "DUPLICATE_BOOKING",
        "NO_SEATS_AVAILABLE",
      ])
    );
    // DB CHECK set (artifacts/seed.sql:99-100) is the canonical membership:
    const dbSet = [
      "PENDING_PAYMENT",
      "CONFIRMED",
      "PAYMENT_FAILED",
      "CANCELLED",
      "REFUNDED",
    ];
    expect(values).not.toContain("REFUNDED");
    for (const code of ["DUPLICATE_BOOKING", "NO_SEATS_AVAILABLE"]) {
      expect(dbSet).not.toContain(code);
      expect(values).toContain(code);
    }
    // D9 (payment_mockup): payment_attempts.status gained REFUNDED
    expect(Object.values(PaymentAttemptStatus)).toEqual([
      "INITIATED",
      "SUCCESS",
      "FAILED",
      "REFUNDED",
    ]);
  });

  test.todo(
    "BK-UT-011 Target [FIX §6]: BookingStatus === DB CHECK set (5 values); RPC codes live in their own type"
  );

  test("BK-UT-012: TrialClassQuerySchema.available is a boolean transform of the query string", () => {
    expect(parseOk(TrialClassQuerySchema, { available: "true" })).toEqual({
      available: true,
    });
    expect(parseOk(TrialClassQuerySchema, { available: "false" })).toEqual({
      available: false,
    });
    expect(parseOk(TrialClassQuerySchema, {})).toEqual({ available: false });
  });
});

describe("BK-UT error mapping (L1)", () => {
  test("BK-UT-016: error classes map to status codes and the structured envelope every UI test asserts against", () => {
    expect(new ConflictError("No seats available for this class").statusCode).toBe(409);
    expect(new ConflictError("x").code).toBe("CONFLICT");
    expect(new NotFoundError("Booking", "BKG-1").statusCode).toBe(404);
    expect(new NotFoundError("Booking", "BKG-1").message).toBe(
      "Booking with ID BKG-1 not found"
    );
    expect(new DatabaseError("Failed to create booking").statusCode).toBe(500);

    const parsed = CreateBookingSchema.safeParse({});
    expect(parsed.success).toBe(false);
    const zodError = (parsed as { error: ZodError }).error;
    const validation = new ValidationError(zodError);
    expect(validation.statusCode).toBe(400);
    expect(validation.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(validation.fields ?? {})).toEqual(
      expect.arrayContaining(["trial_class_id"])
    );
    expect(validation.fields?.trial_class_id).toBeTruthy();

    const response = createErrorResponse(validation, "test");
    expect(response.status).toBe(400);
  });

  test("BK-UT-016b: [BUG-ASSERT B8] createErrorResponse envelope is an object, while ApiResponse.error is typed as a string", async () => {
    const response = createErrorResponse(
      new ConflictError("No seats available for this class"),
      "test"
    );
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "No seats available for this class",
        fields: undefined,
        statusCode: 409,
      },
    });
    expect(typeof body.error).toBe("object");
  });

  test.todo(
    "BK-UT-016 Target [FIX B8]: every booking endpoint returns the object envelope, and ApiResponse.error is typed to match it"
  );
});
