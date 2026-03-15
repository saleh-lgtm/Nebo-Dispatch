/**
 * Application Error Class
 *
 * Standardized error handling across the application.
 * Use these error types for consistent error responses.
 */

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "DATABASE_ERROR"
  | "EXTERNAL_SERVICE_ERROR";

export interface ErrorDetails {
  field?: string;
  expected?: string;
  received?: string;
  [key: string]: unknown;
}

/**
 * Custom application error with error codes for consistent handling
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = "INTERNAL_ERROR",
    details?: ErrorDetails
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = errorCodeToStatus(code);
    this.details = details;
    this.isOperational = true;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Map error codes to HTTP status codes
 */
function errorCodeToStatus(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    DATABASE_ERROR: 500,
    EXTERNAL_SERVICE_ERROR: 502,
  };
  return statusMap[code] || 500;
}

// ============================================
// Error Factory Functions
// ============================================

export function unauthorized(message = "Authentication required"): AppError {
  return new AppError(message, "UNAUTHORIZED");
}

export function forbidden(message = "Access denied"): AppError {
  return new AppError(message, "FORBIDDEN");
}

export function notFound(entity: string, id?: string): AppError {
  const message = id ? `${entity} with ID "${id}" not found` : `${entity} not found`;
  return new AppError(message, "NOT_FOUND", { entity, id });
}

export function validationError(message: string, field?: string): AppError {
  return new AppError(message, "VALIDATION_ERROR", { field });
}

export function conflict(message: string, details?: ErrorDetails): AppError {
  return new AppError(message, "CONFLICT", details);
}

export function rateLimited(message = "Too many requests"): AppError {
  return new AppError(message, "RATE_LIMITED");
}

export function databaseError(message: string, details?: ErrorDetails): AppError {
  return new AppError(message, "DATABASE_ERROR", details);
}

export function externalServiceError(
  service: string,
  message: string
): AppError {
  return new AppError(`${service}: ${message}`, "EXTERNAL_SERVICE_ERROR", {
    service,
  });
}

// ============================================
// Error Handling Utilities
// ============================================

/**
 * Type guard to check if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Extract error message safely from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

/**
 * Extract error code from unknown error
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (isAppError(error)) {
    return error.code;
  }
  return "INTERNAL_ERROR";
}

/**
 * Wrap async function with error handling
 * Converts unknown errors to AppError
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  fallbackMessage = "Operation failed"
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw new AppError(getErrorMessage(error) || fallbackMessage, "INTERNAL_ERROR");
  }
}

/**
 * Create a safe result wrapper for server actions
 * Returns { success, data } or { success: false, error }
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: ErrorCode };

export async function safeAction<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
      code: getErrorCode(error),
    };
  }
}
