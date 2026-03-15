/**
 * Shift Swap Utilities
 */

/**
 * Format date/time for display
 */
export function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format short date/time (without weekday)
 */
export function formatShortDateTime(date: Date): string {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format date only
 */
export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format time only
 */
export function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Get shift duration in hours
 */
export function getShiftDuration(start: Date, end: Date): number {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round((diff / (1000 * 60 * 60)) * 10) / 10;
}

/**
 * Check if a swap request is actionable (can be approved/rejected)
 */
export function isActionable(
  status: string,
  isAdmin: boolean,
  isTarget: boolean
): boolean {
  if (status === "PENDING_TARGET" && isTarget) return true;
  if (status === "PENDING_ADMIN" && isAdmin) return true;
  return false;
}

/**
 * Check if a swap request can be cancelled
 */
export function isCancellable(
  status: string,
  isRequester: boolean
): boolean {
  return (
    isRequester &&
    (status === "PENDING_TARGET" || status === "PENDING_ADMIN")
  );
}
