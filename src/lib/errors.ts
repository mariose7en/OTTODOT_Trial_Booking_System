import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "BOOKING_ERROR"
  | "DATABASE_ERROR"
  | "AUTH_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR";

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
  statusCode: number;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly fields?: Record<string, string>;

  constructor(error: ErrorDetails) {
    super(error.message);
    this.name = "AppError";
    this.code = error.code;
    this.statusCode = error.statusCode;
    this.fields = error.fields;
  }
}

export class BookingError extends AppError {
  constructor(message: string, code: ErrorCode = "BOOKING_ERROR") {
    super({
      code,
      message,
      statusCode: 400,
    });
    this.name = "BookingError";
  }
}

export class ValidationError extends AppError {
  constructor(zodError: ZodError) {
    const fields: Record<string, string> = {};
    zodError.errors.forEach((err) => {
      const field = err.path.join(".");
      fields[field] = err.message;
    });

    super({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      fields,
      statusCode: 400,
    });
    this.name = "ValidationError";
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super({
      code: "DATABASE_ERROR",
      message: message || "Database operation failed",
      statusCode: 500,
    });
    this.name = "DatabaseError";
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super({
      code: "NOT_FOUND",
      message,
      statusCode: 404,
    });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super({
      code: "CONFLICT",
      message,
      statusCode: 409,
    });
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Rate limit exceeded") {
    super({
      code: "RATE_LIMIT_EXCEEDED",
      message,
      statusCode: 429,
    });
    this.name = "RateLimitError";
  }
}

export function handleApiError(error: unknown): {
  success: false;
  error: ErrorDetails;
} {
  console.error("[API Error]", error);

  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        fields: error.fields,
        statusCode: error.statusCode,
      },
    };
  }

  if (error instanceof ZodError) {
    const validationError = new ValidationError(error);
    return {
      success: false,
      error: {
        code: validationError.code,
        message: validationError.message,
        fields: validationError.fields,
        statusCode: validationError.statusCode,
      },
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error.message || "An unexpected error occurred",
        statusCode: 500,
      },
    };
  }

  return {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      statusCode: 500,
    },
  };
}

export function createErrorResponse(
  error: unknown,
  context?: string
): Response {
  const errorResponse = handleApiError(error);
  
  if (context) {
    console.error(`[${context}]`, errorResponse.error);
  }

  return Response.json(errorResponse, {
    status: errorResponse.error.statusCode,
  });
}
