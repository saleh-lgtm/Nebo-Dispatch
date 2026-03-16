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
 * Format time only (from Date)
 */
export function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format hour integer (0-23) to display string
 */
export function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}${period}`;
}

/**
 * Format shift time range
 */
export function formatShiftTime(startHour: number, endHour: number): string {
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
}

/**
 * Get shift duration in hours (from integer hours)
 */
export function getShiftDuration(startHour: number, endHour: number): number {
  if (endHour > startHour) {
    return endHour - startHour;
  }
  // Overnight shift
  return 24 - startHour + endHour;
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
