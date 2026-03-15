/**
 * Error Handling Module
 *
 * Centralized error handling for consistent error responses.
 *
 * Usage:
 *   import { notFound, validationError, safeAction } from "@/lib/errors";
 *
 *   // Throw typed errors
 *   throw notFound("User", userId);
 *   throw validationError("Invalid email format", "email");
 *
 *   // Wrap server actions for safe results
 *   const result = await safeAction(() => createUser(data));
 *   if (!result.success) {
 *     console.error(result.error, result.code);
 *   }
 */

export {
  // Error class
  AppError,
  type ErrorCode,
  type ErrorDetails,
  type ActionResult,

  // Factory functions
  unauthorized,
  forbidden,
  notFound,
  validationError,
  conflict,
  rateLimited,
  databaseError,
  externalServiceError,

  // Utilities
  isAppError,
  getErrorMessage,
  getErrorCode,
  withErrorHandling,
  safeAction,
} from "./AppError";
