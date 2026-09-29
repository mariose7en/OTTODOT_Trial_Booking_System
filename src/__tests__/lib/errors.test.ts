/**
 * Errors unit suite (fix_plan §7: "no suite for lib/errors").
 * `src/__tests__/booking/bookingSchema.test.ts` covers the classes as they are
 * used by the booking routes; this file pins the mapping table itself.
 */
import {
  AppError,
  BookingError,
  ConflictError,
  DatabaseError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  createErrorResponse,
  handleApiError,
} from "@/lib/errors";
import { ZodError, z } from "zod";
import fs from "node:fs";

describe("error classes → status codes", () => {
  test("AppError carries code / statusCode / fields", () => {
    const err = new AppError({
      code: "BOOKING_ERROR",
      message: "boom",
      statusCode: 418,
      fields: { a: "b" },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AppError");
    expect(err.code).toBe("BOOKING_ERROR");
    expect(err.statusCode).toBe(418);
    expect(err.fields).toEqual({ a: "b" });
  });

  test("BookingError defaults to 400 / BOOKING_ERROR", () => {
    const err = new BookingError("nope");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BOOKING_ERROR");
    expect(new BookingError("x", "VALIDATION_ERROR").code).toBe(
      "VALIDATION_ERROR"
    );
  });

  test("ValidationError flattens zod issues into dotted field keys", () => {
    const parsed = z
      .object({ parent: z.object({ email: z.string().email() }) })
      .safeParse({ parent: { email: "nope" } });
    const err = new ValidationError((parsed as { error: ZodError }).error);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Validation failed");
    expect(Object.keys(err.fields ?? {})).toContain("parent.email");
    expect(err.fields?.["parent.email"]).toBe("Invalid email address");
  });

  test("DatabaseError is 500 and adopts the original stack", () => {
    const original = new Error("pg down");
    const err = new DatabaseError("", original);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Database operation failed");
    expect(err.stack).toBe(original.stack);
    expect(new DatabaseError("explicit").message).toBe("explicit");
  });

  test("NotFoundError message with and without an id", () => {
    expect(new NotFoundError("Booking", "BKG-1").message).toBe(
      "Booking with ID BKG-1 not found"
    );
    expect(new NotFoundError("Booking").message).toBe("Booking not found");
    expect(new NotFoundError("Booking", "BKG-1").statusCode).toBe(404);
    expect(new NotFoundError("Booking", "BKG-1").code).toBe("NOT_FOUND");
  });

  test("ConflictError is 409 / CONFLICT", () => {
    const err = new ConflictError("No seats available for this class");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  test("RateLimitError is 429 / RATE_LIMIT_EXCEEDED", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(err.message).toBe("Rate limit exceeded");
    expect(new RateLimitError("slow down").message).toBe("slow down");
  });

  test("[BUG-ASSERT] RateLimitError is dead code — no route in src/app/api ever constructs it (fix_plan §3.1)", () => {
    // The class exists and is correct, which is exactly why the gap is easy to
    // miss: nothing throws it, so the documented 429 can never be returned.
    const routeFiles = (fs.readdirSync("src/app/api", { recursive: true }) as string[])
      .filter((f) => f.endsWith("route.ts"))
      .map((f) => fs.readFileSync(`src/app/api/${f}`, "utf-8"));
    expect(routeFiles.length).toBeGreaterThan(10);
    expect(
      routeFiles.filter((src) => src.includes("RateLimitError"))
    ).toHaveLength(0);
  });
});

describe("handleApiError / createErrorResponse", () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  test("AppError branch returns the envelope unchanged", () => {
    const res = handleApiError(new ConflictError("full"));
    expect(res).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "full",
        fields: undefined,
        statusCode: 409,
      },
    });
  });

  test("ZodError branch becomes VALIDATION_ERROR 400 with fields", () => {
    const parsed = z.object({ a: z.string() }).safeParse({});
    const res = handleApiError((parsed as { error: ZodError }).error);
    expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(res.error.statusCode).toBe(400);
    expect(res.error.fields).toHaveProperty("a");
  });

  test("generic Error → INTERNAL_ERROR 500", () => {
    expect(handleApiError(new Error("kaboom")).error).toEqual({
      code: "INTERNAL_ERROR",
      message: "kaboom",
      statusCode: 500,
    });
  });

  test("non-Error value → INTERNAL_ERROR 500 with the default message", () => {
    expect(handleApiError("just a string").error).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      statusCode: 500,
    });
    expect(handleApiError(undefined).error.message).toBe(
      "An unexpected error occurred"
    );
  });

  test("createErrorResponse sets the HTTP status from statusCode and logs the context", async () => {
    const response = createErrorResponse(new NotFoundError("Booking", "X"), "test");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Booking with ID X not found",
        fields: undefined,
        statusCode: 404,
      },
    });
    expect(spy).toHaveBeenCalledWith("[test]", body.error);
  });

  test("[BUG-ASSERT B8] the envelope's `error` is an object while ApiResponse.error is typed string", () => {
    const body = handleApiError(new ConflictError("full"));
    expect(typeof body.error).toBe("object");
    // src/types/booking.ts: `error?: string` — the two cannot both be right
    expect(fs.readFileSync("src/types/booking.ts", "utf-8")).toContain(
      "error?: string"
    );
  });

  test.todo(
    "Target [FIX B8]: ApiResponse.error is typed as ErrorDetails and every route returns the object envelope"
  );
});
