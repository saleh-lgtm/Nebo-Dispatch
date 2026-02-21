"use client";

import { useContext, useCallback } from "react";
import { ToastContext } from "@/components/ui/ToastProvider";
import type { ToastType } from "@/components/ui/Toast";

/**
 * Custom hook to access the toast notification system.
 * Must be used within a ToastProvider.
 *
 * @example
 * ```tsx
 * const { toast, success, error, warning, info, dismiss } = useToast();
 *
 * // Using the generic toast function
 * toast("Hello World", "info", 3000);
 *
 * // Using convenience methods
 * success("Operation completed!");
 * error("Something went wrong");
 * warning("Please check your input");
 * info("New update available");
 *
 * // Dismiss a specific toast
 * const toastId = success("Processing...");
 * // Later...
 * dismiss(toastId);
 * ```
 */
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useToast must be used within a ToastProvider. " +
        "Make sure your component is wrapped with <ToastProvider>."
    );
  }

  const { addToast, removeToast, toasts } = context;

  /**
   * Display a toast notification
   * @param message - The message to display
   * @param type - The type of toast (success, error, warning, info)
   * @param duration - Duration in ms before auto-dismiss (0 for no auto-dismiss)
   * @returns The toast ID (can be used to dismiss programmatically)
   */
  const toast = useCallback(
    (
      message: string,
      type: ToastType = "info",
      duration: number = 5000
    ): string => {
      return addToast(message, type, duration);
    },
    [addToast]
  );

  /**
   * Display a success toast
   * @param message - The message to display
   * @param duration - Duration in ms before auto-dismiss
   * @returns The toast ID
   */
  const success = useCallback(
    (message: string, duration: number = 5000): string => {
      return addToast(message, "success", duration);
    },
    [addToast]
  );

  /**
   * Display an error toast
   * @param message - The message to display
   * @param duration - Duration in ms before auto-dismiss
   * @returns The toast ID
   */
  const error = useCallback(
    (message: string, duration: number = 5000): string => {
      return addToast(message, "error", duration);
    },
    [addToast]
  );

  /**
   * Display a warning toast
   * @param message - The message to display
   * @param duration - Duration in ms before auto-dismiss
   * @returns The toast ID
   */
  const warning = useCallback(
    (message: string, duration: number = 5000): string => {
      return addToast(message, "warning", duration);
    },
    [addToast]
  );

  /**
   * Display an info toast
   * @param message - The message to display
   * @param duration - Duration in ms before auto-dismiss
   * @returns The toast ID
   */
  const info = useCallback(
    (message: string, duration: number = 5000): string => {
      return addToast(message, "info", duration);
    },
    [addToast]
  );

  /**
   * Dismiss a toast by its ID
   * @param toastId - The ID of the toast to dismiss
   */
  const dismiss = useCallback(
    (toastId: string): void => {
      removeToast(toastId);
    },
    [removeToast]
  );

  /**
   * Dismiss all toasts
   */
  const dismissAll = useCallback((): void => {
    toasts.forEach((t) => removeToast(t.id));
  }, [toasts, removeToast]);

  return {
    // New API
    toast,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
    toasts,
    // Backward compatibility - addToast and removeToast from context
    addToast,
    removeToast,
  };
}

export default useToast;
